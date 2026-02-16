# Smart Parking System

A full-stack application for managing parking lots, slots, and sessions. It consists of three components:

- **Backend** — Express.js REST API with MongoDB
- **Frontend (Admin Portal)** — React/Vite web app for parking lot administrators
- **Mobile App** — Expo/React Native app for end-users
- **ANPR Service** — Python FastAPI microservice for automatic number plate recognition (YOLOv8 + EasyOCR)

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [MongoDB](https://www.mongodb.com/) — a running instance or a MongoDB Atlas connection string
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — for running the mobile app (`npm install -g expo-cli`)
- (Optional) [Firebase project](https://console.firebase.google.com/) — only if you want push notifications

---

## Project Structure

```
Smart-Parking-System/
├── backend/          # Express.js REST API
├── frontend/         # React + Vite admin portal
├── mobile/           # Expo/React Native mobile app
├── anpr-service/     # Python ANPR microservice
└── README.md
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd Smart-Parking-System
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
MONGO_URI=<your_mongodb_connection_string>
JWT_SECRET=<your_jwt_secret>
PORT=5000

# Firebase push notifications (optional)
FIREBASE_SERVICE_ACCOUNT=<json_string>
# OR
FIREBASE_SERVICE_ACCOUNT_PATH=<path_to_service_account_key.json>
```

Add the ANPR service URL (optional, if running ANPR on a different host/port):

```env
ANPR_SERVICE_URL=http://localhost:8000
```

Run the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:5000`. You can verify it's running by visiting `http://localhost:5000/` — it should return:

```json
{ "status": "Smart Parking Backend Running" }
```

#### Seed an Admin User

```bash
node src/utils/SeedAdmin.js
```

### 3. Frontend Setup (Admin Portal)

```bash
cd frontend
npm install
```

> **Note:** For local development, update the API base URL in `frontend/src/services/api.js` to point to your local backend:
>
> ```js
> baseURL: "http://localhost:5000/api"
> ```

Run the development server:

```bash
npm run dev
```

The admin portal will be available at `http://localhost:5173` (default Vite port).

### 4. Mobile App Setup

```bash
cd mobile
npm install
```

> **Note:** For local development, set the API base URL to your machine's local IP (not `localhost`), since mobile devices can't reach `localhost` on your computer.
>
> Either set the environment variable:
>
> ```bash
> EXPO_PUBLIC_API_BASE_URL=http://<your-local-ip>:5000/api
> ```
>
> Or edit the defaults in `mobile/src/constants/config.ts`.

Start the Expo dev server:

```bash
npm start
```

Then press:
- `a` to open on an Android emulator
- `i` to open on an iOS simulator
- Scan the QR code with the Expo Go app on a physical device

---

## Available Scripts

### Backend (`backend/`)

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload (nodemon) |
| `npm start` | Start production server |
| `npm test` | Run all tests |
| `npm test -- auth.test.js` | Run a specific test file |
| `npm test -- -t "pattern"` | Run tests matching a pattern |

### Frontend (`frontend/`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Create production build |
| `npm run lint` | Run ESLint |

### Mobile (`mobile/`)

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` | Open on Android emulator |
| `npm run ios` | Open on iOS simulator |
| `npm run web` | Open in web browser |
| `npm run lint` | Run ESLint |

### 5. ANPR Service Setup (Optional)

The ANPR service enables camera-based automatic plate recognition for entry/exit.

```bash
cd anpr-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the service
python main.py
```

The ANPR service runs on `http://localhost:8000` by default. See `anpr-service/README.md` for configuration options.

---

## API Overview

### Admin Routes (require admin authentication)

- `POST /api/auth/register` — Register a new admin
- `POST /api/auth/login` — Admin login
- `GET /api/dashboard` — Dashboard statistics
- `/api/parking` — CRUD for parking lots and slots
- `/api/sessions` — Session management
- `/api/admin` — Admin management

### User Routes (require user authentication)

- `POST /api/user/auth/register` — Register a new user
- `POST /api/user/auth/login` — User login
- `/api/user/wallet` — Wallet operations
- `/api/user/*` — Lots browsing, sessions, vehicles

### ANPR Routes (image-based entry/exit)

- `POST /api/anpr/detect` — Standalone plate detection (multipart image upload)
- `POST /api/anpr/entry` — Detect plate from image + entry flow (requires `lotId`, optional `vehicleType`)
- `POST /api/anpr/exit` — Detect plate from image + exit flow (requires `lotId`)

---

## Testing

The backend uses **Jest** with **MongoDB Memory Server** for isolated in-memory tests — no running MongoDB instance required for tests.

```bash
cd backend
npm test
```

### Test Files

| File | Description |
|---|---|
| `auth.test.js` | Admin authentication (register, login) |
| `parking.test.js` | Entry/exit flow, slot allocation, fare calculation |
| `vehicle.test.js` | Vehicle plate management |
| `wallet.test.js` | Wallet top-up and deduction |
| `lots-sessions.test.js` | Lot CRUD and session queries |
| `e2e-parking-flow.test.js` | End-to-end flow with 10 ANPR users (see below) |

### E2E Parking Flow Test

The `e2e-parking-flow.test.js` test simulates a full parking lifecycle using 10 users with license plates extracted from real ANPR camera images. It runs entirely in-memory (no real DB needed).

**Run it:**

```bash
cd backend
npm test -- e2e-parking-flow.test.js
```

**What it covers:**

- Creates 10 users (8 cars, 2 bikes) with plates from ANPR images
- Assigns each user a wallet topped up with ₹1000
- Creates a parking lot with 15 slots (10 CAR + 5 BIKE), ₹60/hr rate, 15-min free window
- All 10 vehicles enter → verifies slot assignment and session creation
- Verifies sessions are linked to registered users
- Simulates 90 min of parking → exit → verifies fare (~₹75) deducted from wallets
- Tests insufficient wallet balance → `UNPAID` status
- Tests parking within the free window → ₹0 fare, wallet untouched

---

## Seed Scripts

### Seed Admin User

```bash
cd backend
node src/utils/SeedAdmin.js
```

Creates a default admin account (`admin` / `admin123`).

### Seed Parking Lot + Slots

```bash
cd backend
node src/utils/seed.js
```

Creates a "Main Parking" lot with 10 CAR slots.

### Seed ANPR Demo Data

Populates the database with a full demo dataset for the admin dashboard:

```bash
cd backend
node src/utils/seedANPR.js
```

**What it creates:**

- 1 Admin user → `username: admin` / `password: admin123`
- 1 Parking lot ("Hyderabad Central Parking") with 15 slots (10 CAR + 5 BIKE)
- 10 Users with plates from ANPR camera images, each with a funded wallet (₹1000)
- 4 active parking sessions (currently IN)
- 6 completed sessions (OUT) with fare deductions

**Mobile app login** for any seeded user: use the email from below + password `parking@123`

| User | Email | Plate | Vehicle |
|---|---|---|---|
| Ravi Kumar | ravi.kumar@smartpark.in | TS08FR4989 | CAR |
| Sneha Reddy | sneha.reddy@smartpark.in | AP25AL4739 | CAR |
| Arjun Rao | arjun.rao@smartpark.in | TS09EJ9509 | CAR |
| Priya Sharma | priya.sharma@smartpark.in | TS07EG5768 | CAR |
| Vikram Singh | vikram.singh@smartpark.in | TS07JE1214 | CAR |
| Meena Devi | meena.devi@smartpark.in | AP28CE5390 | CAR |
| Rahul Verma | rahul.verma@smartpark.in | TS07HL1882 | CAR |
| Amit Patil | amit.patil@smartpark.in | MH26CH0480 | CAR |
| Sanjay Jadhav | sanjay.jadhav@smartpark.in | MH26AK0328 | BIKE |
| Kiran Goud | kiran.goud@smartpark.in | TS08CH8182 | BIKE |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Express.js, MongoDB (Mongoose), JWT, bcrypt |
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui, Radix UI |
| Mobile | React Native, Expo SDK 54, expo-router |
| Testing | Jest, Supertest, MongoDB Memory Server |
