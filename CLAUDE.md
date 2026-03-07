# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Smart Parking System — full-stack application for managing parking lots, slots, and sessions with automatic number plate recognition. Four components:

- **Backend** (`backend/`) — Express.js v5 REST API, MongoDB via Mongoose v9, CommonJS modules
- **Frontend** (`frontend/`) — React 19 + Vite admin portal for parking lot administrators
- **Mobile** (`mobile/`) — Expo SDK 54 + React Native app for end-users (TypeScript)
- **ANPR Service** (`anpr-service/`) — Python FastAPI microservice (YOLOv8 + PaddleOCR)

## Commands

### Backend
```bash
cd backend && npm run dev              # Dev server (nodemon, port 5000)
cd backend && npm start                # Production
cd backend && npm test                 # All tests (Jest + MongoDB Memory Server)
cd backend && npm test -- parking.test.js        # Single test file
cd backend && npm test -- -t "allows entry"      # Tests matching pattern
```

### Frontend
```bash
cd frontend && npm run dev    # Vite dev server (port 5173)
cd frontend && npm run build  # Production build
cd frontend && npm run lint   # ESLint
```

### Mobile
```bash
cd mobile && npm start         # Expo dev server
cd mobile && npm run android   # Android emulator
cd mobile && npm run ios       # iOS simulator
cd mobile && npm run lint      # ESLint
```

### ANPR Service
```bash
cd anpr-service && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py                          # FastAPI on port 8000
uvicorn main:app --reload --port 8000   # With hot-reload
cd anpr-service && python -m pytest tests/   # Run ANPR tests
```

### Docker (full stack)
```bash
docker compose up --build        # All services (mongo, backend, anpr, frontend)
docker compose up backend mongodb  # Backend + DB only
```

### Seed Data
```bash
cd backend && node src/utils/SeedAdmin.js   # Default admin (admin/admin123)
cd backend && node src/utils/seed.js        # Sample parking lot + 10 CAR slots
cd backend && node src/utils/seedANPR.js    # Full demo: admin, 10 users, lot, sessions
```

## Architecture

### Backend: Request Flow
Routes → Middleware (auth) → Controllers → Services → Models (Mongoose)

Controllers are thin — they validate input and call service methods. Business logic lives in `src/services/`:
- **ParkingService** — `handleEntry()` and `handleExit()` orchestrate the full parking flow: check active sessions → find available slot → create session → link to user by plate → occupy/release slot → wallet deduction → push notification
- **WalletService** — Atomic fare deduction via `findOneAndUpdate` with `$gte` balance guard (no overdraft). Low-balance push notifications at ₹50 threshold
- **NotificationService** — Firebase push via FCM. Gracefully no-ops if Firebase is unconfigured. Auto-clears stale FCM tokens on `messaging/registration-token-not-registered`

### Dual Auth System
Two separate JWT auth flows sharing the same `JWT_SECRET`:
1. **Admin** — `auth.middleware.js` checks `role === "ADMIN"`, attaches `req.admin`
2. **User** — `userAuth.middleware.js` checks `role === "USER"`, attaches `req.user` (with `{ id, role }`)

Both extract `Bearer <token>` from `Authorization` header. Token payload: `{ id, role }`.

### Data Models & Key Behaviors

**ParkingLot** — `name`, `code` (unique, uppercase), `location` (address + lat/lng), `totalSlots`, `pricing` (`ratePerHour`, `freeMinutes`), `active`

**ParkingSlot** — Compound unique index on `(lotId, slotNumber)`. Compound index on `(lotId, status, vehicleType)` for fast availability queries. Key methods:
- `ParkingSlot.findAvailableSlot(lotId, vehicleType)` — static, returns first available slot sorted by slotNumber
- `slot.occupy(sessionId)` / `slot.release()` — instance methods

**ParkingSession** — Partial unique index on `(plateNumber, status)` where `status === "IN"` prevents duplicate active sessions for same vehicle. **Pre-save hook** auto-calculates `durationMinutes` and `fare` when status changes to `"OUT"` — it fetches lot pricing and applies `freeMinutes` deduction. Payment statuses: `PAID`, `UNPAID`, `NO_USER`

**User** — `vehiclePlates` stored as `String[]` (uppercase, trimmed). No separate Vehicle collection. `fcmToken` for push. `walletBalance` field (legacy; actual balance is in Wallet model)

**Wallet** — Separate collection with `userId` (unique), `balance`, and embedded `transactions[]` array (each with type, amount, description, reference)

**AdminUser** — Simple username/password model, role always `"ADMIN"`

### API Route Groups

**Admin routes** (adminAuth middleware):
- `/api/auth` — Admin register/login
- `/api/parking` — POST `/entry`, POST `/exit` (no auth — for gate hardware)
- `/api/dashboard` — GET `/overview` (aggregate stats)
- `/api/admin` — Admin CRUD
- `/api/sessions` — GET all sessions

**User routes** (userAuth middleware):
- `/api/user/auth` — User register/login
- `/api/user/wallet` — Balance + top-up
- `/api/user/lots`, `/api/user/lots/:id` — Public (no auth)
- `/api/user/sessions/active`, `/api/user/sessions/history` — Protected
- `/api/user/vehicles` — Link/unlink plates
- `/api/user/profile` — GET user profile
- `/api/user/fcm-token` — POST to save FCM token

**ANPR routes** (no auth — hardware integration):
- `/api/anpr/detect` — Standalone plate detection (multipart image)
- `/api/anpr/entry` — Detect plate + entry flow (requires `lotId`)
- `/api/anpr/exit` — Detect plate + exit flow (requires `lotId`)

### ANPR Service Architecture

**Image pipeline** (`anpr/pipeline.py`): Image → YOLO detection → crop & preprocess → OCR → plate normalization

**Video pipeline** (`anpr/video_pipeline.py`): Multi-threaded, CPU-optimized. Stages: Frame Reader (rate-limited) → Motion Filter (frame differencing) → YOLO Detector → Spatial Dedup (IoU-based) → OCR Pool (thread pool) → Plate Dedup (cooldown-based) → callback. Drops frames under back-pressure (non-blocking queues).

**Dual detector support**: `.pt` files use `PlateDetector` (ultralytics), `.onnx` files use `ONNXPlateDetector` (3–5× faster on CPU). Selected automatically based on `ANPR_MODEL_PATH` extension.

**Dual OCR support**: PaddleOCR is primary (3–4× faster than EasyOCR). Falls back to EasyOCR if PaddlePaddle not installed. Both implement same `extract_text(image) → str` interface.

**Plate normalization** (`anpr/plate_rules.py`): Two-pass approach for Indian plates — (1) strict regex match, (2) segment-aware OCR correction (e.g., `0→O`, `1→I` at letter positions) then re-match. Supports standard state-issued and BH-series (Bharat) formats.

**Deduplication layers**:
- `SpatialDeduplicator` — IoU-based bbox caching to skip redundant OCR on same crop region (3s TTL)
- `PlateDeduplicator` — Cooldown-based: same plate string reported at most once per N seconds

**FastAPI endpoints**: POST `/detect` (image), POST `/detect-video` (video file), WS `/ws/stream` (real-time JPEG frames), POST `/stream/start` + GET `/stream/{id}/latest` + DELETE `/stream/{id}` (persistent RTSP/webcam streams)

### Frontend Architecture
- React Router v7 with `BrowserRouter`. Public `/login` route; all others wrapped in `AppLayout` (sidebar + content) with `ProtectedRoute` HOC (checks `localStorage` token)
- Auth token auto-attached via axios request interceptor (`services/api.js`). 401 responses auto-redirect to `/login`
- API base URL: `VITE_API_BASE_URL` env var (build-time), defaults to `http://localhost:5000/api`
- `@` path alias → `src/` (vite.config.js)
- UI: shadcn/ui + Radix primitives + Tailwind CSS v4

### Mobile Architecture
- Expo Router v6 (file-based routing in `app/` directory)
  - `(auth)/` group: login, register, link-vehicle
  - `(tabs)/` group: home (lots list), active session, history, wallet, profile
  - `lot/[id]` dynamic route
- Auth: `AuthContext` → `useAuth()` hook. Token stored via `authStorage` service (expo-secure-store on native, localStorage on web)
- API base URL: `EXPO_PUBLIC_API_BASE_URL` env var, or defaults in `src/constants/config.ts`. Use machine LAN IP (not localhost) for physical devices
- Response interceptor unwraps `{ success, data }` envelope so callers get `res.data = actual payload`
- Push notifications initialized in root layout via `useNotifications` hook
- Shared enums in `src/constants/config.ts`: `SLOT_STATUS`, `SESSION_STATUS`, `VEHICLE_TYPES`
- `@` path alias → `src/` (tsconfig.json)

### Docker Setup
`docker-compose.yml` defines: `mongodb` (Mongo 7), `backend` (Node 22-alpine), `anpr` (Python 3.11-slim), `frontend` (multi-stage: Node build → nginx serve). Root `.env.example` documents required/optional env vars. ANPR model weights are volume-mounted (excluded from image via .dockerignore).

## Testing

Backend uses **Jest** + **Supertest** + **MongoDB Memory Server** — no running MongoDB needed.

Test infrastructure in `backend/tests/`:
- `db.js` — `connect()`, `cleanup()`, `disconnect()` lifecycle for in-memory MongoDB
- `app.js` — Express app factory (`createApp()`) that mirrors `server.js` routes without starting a listener or connecting to real DB
- `helpers.js` — Factories: `createUser()`, `createAdmin()`, `createLot()`, `createSlots()`, `createWallet()` + token generators `userToken(userId)`, `adminToken(adminId)`. Sets `JWT_SECRET = "test-jwt-secret"` on `process.env`

Test pattern — every test file follows:
```
beforeAll → db.connect()
afterEach → db.cleanup()
afterAll → db.disconnect()
```

Test files: `auth.test.js`, `parking.test.js`, `vehicle.test.js`, `wallet.test.js`, `lots-sessions.test.js`, `e2e-parking-flow.test.js`

Jest config: `testTimeout: 15000`, runs with `--runInBand --forceExit`.

ANPR tests: `cd anpr-service && python -m pytest tests/` — unit tests for image processor, plate rules, spatial dedup, plate dedup, motion detector, pipeline integration.

## Environment Variables

### Backend `.env`
```
MONGO_URI=<mongodb_connection_string>
JWT_SECRET=<your_secret>
PORT=5000
ANPR_SERVICE_URL=http://localhost:8000          # optional, defaults to localhost:8000
FIREBASE_SERVICE_ACCOUNT=<json_string>          # optional, OR:
FIREBASE_SERVICE_ACCOUNT_PATH=<path_to_key.json>
```

### ANPR Service (all optional)
```
ANPR_PORT=8000
ANPR_MODEL_PATH=models/best.pt    # or models/best.onnx for faster CPU inference
ANPR_USE_GPU=false
ANPR_DEBUG=false
ANPR_LOG_LEVEL=INFO
ANPR_MAX_FILE_MB=10
ANPR_MAX_IMAGE_DIM=4096
ANPR_MAX_DETECTIONS=3
ANPR_DESKEW=false
ANPR_DUAL_OCR=false
# Video pipeline
ANPR_VIDEO_FPS_TARGET=6
ANPR_VIDEO_MOTION_THRESH=0.015
ANPR_VIDEO_OCR_WORKERS=2
ANPR_VIDEO_PLATE_COOLDOWN=10
ANPR_VIDEO_SPATIAL_IOU=0.85
ANPR_MAX_VIDEO_MB=100
```

### Frontend
`VITE_API_BASE_URL` — baked in at build time. Default: `http://localhost:5000/api`

### Mobile
`EXPO_PUBLIC_API_BASE_URL` — runtime env var. Defaults differ per platform (web: localhost, native: `192.168.1.18`). Edit `mobile/src/constants/config.ts` for persistent changes.
