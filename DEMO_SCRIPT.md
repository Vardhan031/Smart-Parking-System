# Smart Parking System — Demo Script

> Step-by-step guide for presenting the project during evaluation.
> Estimated time: **15–20 minutes**

---

## 0. Pre-Demo Setup (Do This Before the Evaluation)

### Step 1: Seed the database

This creates everything needed for the demo in one command:

```bash
cd backend && node src/utils/seedDemo.js
```

It will create:
- **Admin account** — `admin` / `admin123`
- **Demo user** — `demo@smartpark.com` / `demo123` with plate `KA01AB1234`
- **Parking lot** — "SmartPark Main Lot" (20 slots, ₹30/hr, 15 min free)
- **Wallet** — ₹500 balance

### Step 2: Start all services

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Admin Portal
cd frontend && npm run dev

# Terminal 3 — Mobile App
cd mobile && npm start

# Terminal 4 — ANPR Service
cd anpr-service && source venv/bin/activate && python main.py
```

### Step 3: Prepare

- [ ] Open Admin Portal in browser (`http://localhost:5173`)
- [ ] Open Mobile App on phone/emulator
- [ ] Have a car image with a visible number plate ready (ideally plate `KA01AB1234` or any Indian plate)
- [ ] Login to Admin Portal with `admin` / `admin123`
- [ ] Login to Mobile App with `demo@smartpark.com` / `demo123`

---

## 1. Introduction (2 min)

**What to say:**

> "This is a Smart Parking System — a full-stack application that automates
> parking management using camera-based number plate recognition."

**Four components:**
- **Backend** — Express.js REST API with MongoDB
- **Admin Portal** — React web app for administrators
- **Mobile App** — React Native (Expo) app for drivers
- **ANPR Service** — Python FastAPI microservice (YOLOv8 + EasyOCR)

> "The entire parking lifecycle is automated:
> vehicle enters → camera detects plate → slot assigned → fare calculated on exit → wallet auto-debited."

---

## 2. Admin Dashboard Quick Tour (2 min)

1. Show the **Dashboard** — utilization %, KPIs, recent activity
2. Navigate to **Parking Lots** → show "SmartPark Main Lot"
3. Click into the lot → show the **Parking Slots** layout (all green = available)

---

## 3. Mobile App — Show the User Side (2 min)

1. Show **Home** tab — lot appears with 20 free slots, map view
2. Show **Active** tab — "No Active Session" (will change soon)
3. Show **Wallet** tab — ₹500 balance

---

## 4. 🚗 ENTRY — The Core Demo (3 min)

> "Now let's simulate a car entering the parking lot."

1. In the Admin Portal, navigate to **Gate Control** (sidebar)
2. The "SmartPark Main Lot" is pre-selected
3. On the **Entry Gate** panel:
   - Click the upload area → select the car image
   - Click **"Scan & Enter"**
4. **Show the result:**
   - ✅ "Entry allowed"
   - Detected plate number + confidence score
   - Assigned slot number

5. **Switch to Mobile App:**
   - Go to **Active** tab → pull to refresh
   - 🎉 The session appears! Live timer counting up, slot number, plate, estimated fare
   - **Point out:** No manual check-in — the camera did everything

6. **Switch back to Admin Portal:**
   - Go to **Parking Slots** → one slot is now red (occupied)
   - Go to **Dashboard** → occupied count increased, entry count +1

---

## 5. 🚗 EXIT — Fare & Payment (3 min)

> "Now the car is leaving. Let's process the exit."

1. Go back to **Gate Control** in the Admin Portal
2. On the **Exit Gate** panel:
   - Upload the same car image
   - Click **"Scan & Exit"**
3. **Show the result:**
   - ✅ "Exit allowed"
   - Duration in minutes
   - Calculated fare (₹30/hr with 15 min free)
   - Payment status: **PAID** (auto-deducted from wallet)

4. **Switch to Mobile App:**
   - **Active** tab → session is gone
   - **History** tab → completed session with duration + fare
   - **Wallet** tab → debit transaction visible, balance reduced
   - **Point out:** Fare was automatically deducted — no manual payment

5. **Switch back to Admin Portal:**
   - **Gate Activity Log** (bottom of Gate Control page) shows both entry + exit
   - **Sessions** page → completed session with all details
   - **Dashboard** → stats updated (exit count +1, revenue increased)
   - **Analytics** → wallet transaction visible

---

## 6. Technical Highlights (2 min)

Use this if the evaluator asks about architecture or code quality.

### ANPR Pipeline
1. **YOLOv8** detects number plate region
2. **OpenCV** preprocesses (grayscale, contrast, upscale)
3. **EasyOCR** extracts text
4. **Plate Rules** normalizes for Indian plate formats (O→0, I→1)

### Dual Authentication
- Admin: `auth.middleware.js` → `role === "ADMIN"` → `req.admin`
- User: `userAuth.middleware.js` → `role === "USER"` → `req.user`

### Service Layer
- `parking.service.js` — Entry/exit flow, slot allocation
- `wallet.service.js` — Atomic fare deduction (prevents overdraft)
- `notification.service.js` — Firebase push notifications

### Auto-Calculated Fare
- Mongoose pre-save hook on `ParkingSession` model
- Calculates duration + fare from lot pricing when status changes to "OUT"

### Automated Tests
```bash
cd backend && npm test
```
- Jest + MongoDB Memory Server (in-memory, no external DB)
- Covers: auth, parking, vehicles, wallet, lots & sessions

---

## 7. Bonus Points

- **Push Notifications** — Firebase-based entry/exit + low balance alerts
- **Map View** — Mobile app shows nearby lots on a map
- **Live Timer** — Active session has real-time duration + estimated fare
- **Animated Dashboard** — 3D tilt KPI cards, smooth number counters
- **Microservice Architecture** — ANPR service is independent
- **Wallet System** — Top-up, auto-deduction, transaction history

---

## Quick Reference

| Service        | URL                          |
|----------------|------------------------------|
| Backend API    | `http://localhost:5000/api`  |
| Admin Portal   | `http://localhost:5173`      |
| Mobile (Expo)  | Expo Go app / `exp://...`   |
| ANPR Service   | `http://localhost:8000`      |

| Credentials    | Username/Email              | Password  |
|----------------|-----------------------------|-----------|
| Admin Portal   | `admin`                     | `admin123`|
| Mobile App     | `demo@smartpark.com`        | `demo123` |
