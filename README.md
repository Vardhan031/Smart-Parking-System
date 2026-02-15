# Smart Parking System

A full-stack application for managing parking lots, slots, and sessions. It consists of three components:

- **Backend** — Express.js REST API with MongoDB
- **Frontend (Admin Portal)** — React/Vite web app for parking lot administrators
- **Mobile App** — Expo/React Native app for end-users

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

---

## Testing

The backend uses **Jest** with **MongoDB Memory Server** for isolated in-memory tests — no running MongoDB instance required for tests.

```bash
cd backend
npm test
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Express.js, MongoDB (Mongoose), JWT, bcrypt |
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui, Radix UI |
| Mobile | React Native, Expo SDK 54, expo-router |
| Testing | Jest, Supertest, MongoDB Memory Server |
