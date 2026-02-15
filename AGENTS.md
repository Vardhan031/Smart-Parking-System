# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Smart Parking System is a full-stack application for managing parking lots, slots, and sessions. It has three components:
- **Backend**: Express.js REST API with MongoDB (Mongoose)
- **Frontend (Admin Portal)**: React/Vite web app for parking lot administrators
- **Mobile App**: Expo/React Native app for end-users

## Common Commands

### Backend
```bash
cd backend && npm run dev    # Dev server with nodemon
cd backend && npm start      # Production
cd backend && npm test       # Run all tests
cd backend && npm test -- auth.test.js           # Run single test file
cd backend && npm test -- -t "logs in"           # Run tests matching pattern
```

### Frontend
```bash
cd frontend && npm run dev   # Vite dev server
cd frontend && npm run build # Production build
cd frontend && npm run lint  # ESLint
```

### Mobile
```bash
cd mobile && npm start        # Start Expo dev server
cd mobile && npm run android  # Android emulator
cd mobile && npm run ios      # iOS simulator
cd mobile && npm run lint     # ESLint
```

## Architecture

### Backend Service Layer
Business logic is abstracted into service classes in `backend/src/services/`:
- `ParkingService` - Entry/exit flow, slot allocation, session management
- `WalletService` - Balance operations, fare deduction
- `NotificationService` - Firebase push notifications (gracefully disabled if unconfigured)

### Dual Authentication System
The backend has two separate auth flows with role-based JWT tokens:
1. **Admin Auth** (`/api/auth/*`) - Uses `auth.middleware.js`, checks `role === "ADMIN"`, attaches `req.admin`
2. **User Auth** (`/api/user/auth/*`) - Uses `userAuth.middleware.js`, checks `role === "USER"`, attaches `req.user`

Both use the same `JWT_SECRET` but enforce different role access.

### Data Model Relationships
```
ParkingLot (1) ──── (N) ParkingSlot (1) ──── (0..1) ParkingSession
                                                        │
                                                        └── User (optional)
                                                        └── Wallet (for payments)
```

**Key model behaviors:**
- `ParkingSlot` has static method `findAvailableSlot(lotId, vehicleType)` and instance methods `occupy(sessionId)`, `release()`
- `ParkingSession` auto-calculates `durationMinutes` and `fare` on save when status changes to "OUT" (via pre-save hook)
- Slot status enum: `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`
- Session status enum: `IN`, `OUT`
- Vehicle plates are stored as `vehiclePlates[]` on `User` model (no separate Vehicle collection)
- Vehicle plates are normalized to uppercase and trimmed in `ParkingService`

### API Route Groups
**Admin routes** (protected by `adminAuth`):
- `/api/parking` - CRUD for lots/slots
- `/api/auth` - Admin login/register
- `/api/dashboard` - Admin dashboard stats
- `/api/admin` - Admin management
- `/api/sessions` - Session management

**User routes** (protected by `userAuth`):
- `/api/user/auth` - User login/register
- `/api/user/wallet` - Wallet operations
- `/api/user/*` - User app features (lots, sessions, vehicles)

### Frontend Architecture
- **Routing**: `App.jsx` defines public `/login` route; all other routes use `AppLayout` wrapper with `ProtectedRoute` HOC
- **Auth**: Token stored in `localStorage`, auto-attached via axios interceptor in `services/api.js`
- **API Base**: Hardcoded in `frontend/src/services/api.js` - change for local dev
- **UI Components**: Uses shadcn/ui with Radix primitives and Tailwind CSS; custom components in `components/ui/`
- **Path alias**: `@` resolves to `src/` (configured in `vite.config.js`)

### Mobile Architecture
- **Framework**: Expo SDK 54 with expo-router (file-based routing)
- **Routing**: `app/` directory uses file-based routing - `(auth)` for login/register, `(tabs)` for main app, `lot/[id]` for dynamic routes
- **Auth**: Token stored via `authStorage` service (`src/services/authStorage.ts`) which uses `expo-secure-store` on native, `localStorage` on web; auto-attached via axios interceptor in `src/services/api.ts`
- **State**: `AuthContext` (`src/context/AuthContext.tsx`) manages auth state and exposes `useAuth()` hook
- **API Base**: Set `EXPO_PUBLIC_API_BASE_URL` env var, or edit defaults in `mobile/src/constants/config.ts` - use machine's local IP (not localhost) for physical devices
- **Path alias**: `@` resolves to `src/` (configured in `tsconfig.json`)
- **Push Notifications**: Handled by `useNotifications` hook, initialized in root layout
- **Constants**: `config.ts` exports shared enums (`SLOT_STATUS`, `SESSION_STATUS`, `VEHICLE_TYPES`) for type-safe status handling

## Environment Setup

Backend `.env`:
```
MONGO_URI=<mongodb_connection_string>
JWT_SECRET=<your_secret>
PORT=5000
# Firebase (optional, for push notifications):
FIREBASE_SERVICE_ACCOUNT=<json_string>   # OR
FIREBASE_SERVICE_ACCOUNT_PATH=<path_to_key.json>
```

For local development, update API base URLs:
- Frontend: `frontend/src/services/api.js` → `http://localhost:5000/api`
- Mobile: `mobile/src/constants/config.ts` → `http://<your-local-ip>:5000/api`

## Utilities

- `backend/src/utils/SeedAdmin.js` - Seed initial admin user
- `backend/src/utils/seed.js` - Database seeding utilities

## Testing

Backend uses Jest with MongoDB Memory Server for in-memory testing:
- `tests/db.js` - DB lifecycle (connect/cleanup/disconnect)
- `tests/app.js` - Express app factory (isolates tests from main server.js)
- `tests/helpers.js` - Factories: `createUser()`, `createAdmin()`, `createLot()`, `createSlots()`, `createWallet()`, plus `userToken()`/`adminToken()` for auth headers

Test files: `auth.test.js`, `parking.test.js`, `vehicle.test.js`, `wallet.test.js`, `lots-sessions.test.js`

Tests run with `--runInBand --forceExit` to ensure sequential execution and clean shutdown.

## Notes

- Health check: `GET /` returns `{ status: "Smart Parking Backend Running" }`
