const request = require("supertest");
const db = require("./db");
const createApp = require("./app");
const { createLot, createSlots, createUser, createWallet } = require("./helpers");
const ParkingSession = require("../src/models/ParkingSession");
const ParkingSlot = require("../src/models/ParkingSlot");
const Wallet = require("../src/models/Wallet");

const app = createApp();

beforeAll(async () => await db.connect());
afterEach(async () => await db.cleanup());
afterAll(async () => await db.disconnect());

/**
 * Plate numbers extracted from ANPR camera images
 * (WhatsApp images from 2026-02-16)
 */
const PLATE_DATA = [
    { plate: "TS08FR4989", vehicleType: "CAR",  name: "Ravi Kumar" },
    { plate: "AP25AL4739", vehicleType: "CAR",  name: "Sneha Reddy" },
    { plate: "TS09EJ9509", vehicleType: "CAR",  name: "Arjun Rao" },
    { plate: "TS07EG5768", vehicleType: "CAR",  name: "Priya Sharma" },
    { plate: "TS07JE1214", vehicleType: "CAR",  name: "Vikram Singh" },
    { plate: "AP28CE5390", vehicleType: "CAR",  name: "Meena Devi" },
    { plate: "TS07HL1882", vehicleType: "CAR",  name: "Rahul Verma" },
    { plate: "MH26CH0480", vehicleType: "CAR",  name: "Amit Patil" },
    { plate: "MH26AK0328", vehicleType: "BIKE", name: "Sanjay Jadhav" },
    { plate: "TS08CH8182", vehicleType: "BIKE", name: "Kiran Goud" },
];

const WALLET_TOPUP = 1000; // ₹1000 initial balance for each user
const PARKING_DURATION_MINUTES = 90; // 1.5 hours of parking per vehicle

describe("E2E Parking Flow — 10 users from ANPR images", () => {
    let lot;
    let users = []; // { user, token, wallet, plate, vehicleType }

    beforeEach(async () => {
        // 1️⃣ Create a parking lot with pricing
        lot = await createLot({
            name: "ANPR Test Parking Lot",
            code: "ANPR-LOT-001",
            totalSlots: 15,
            pricing: { ratePerHour: 60, freeMinutes: 15 },
            location: { address: "Hyderabad Highway Toll", latitude: 17.385, longitude: 78.4867 },
        });

        // Create 10 CAR slots + 5 BIKE slots
        await createSlots(lot._id, 10, "CAR");
        await createSlots(lot._id, 5, "BIKE");
        // Fix bike slot numbers (createSlots starts at 1, so bike slots would collide)
        const bikeSlots = await ParkingSlot.find({ lotId: lot._id, vehicleType: "BIKE" });
        for (let i = 0; i < bikeSlots.length; i++) {
            bikeSlots[i].slotNumber = 11 + i;
            await bikeSlots[i].save();
        }

        // 2️⃣ Create 10 users, assign plates, create wallets with ₹1000
        users = [];
        for (const data of PLATE_DATA) {
            const { user, token } = await createUser({
                name: data.name,
                email: `${data.plate.toLowerCase()}@test.com`,
                vehiclePlates: [data.plate],
            });

            const wallet = await createWallet(user._id, WALLET_TOPUP);

            users.push({
                user,
                token,
                wallet,
                plate: data.plate,
                vehicleType: data.vehicleType,
            });
        }
    });

    it("creates 10 users with correct plates and funded wallets", () => {
        expect(users).toHaveLength(10);

        for (const u of users) {
            expect(u.user.vehiclePlates).toContain(u.plate);
            expect(u.wallet.balance).toBe(WALLET_TOPUP);
        }
    });

    it("all 10 vehicles can enter the parking lot", async () => {
        for (const u of users) {
            const res = await request(app)
                .post("/api/parking/entry")
                .send({
                    plateNumber: u.plate,
                    lotId: lot._id,
                    vehicleType: u.vehicleType,
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.action).toBe("OPEN_ENTRY_GATE");
            expect(res.body.data.slotNumber).toBeDefined();
            expect(res.body.data.sessionId).toBeDefined();
        }

        // Verify 10 active sessions exist
        const activeSessions = await ParkingSession.countDocuments({ status: "IN" });
        expect(activeSessions).toBe(10);

        // Verify 10 slots are occupied
        const occupiedSlots = await ParkingSlot.countDocuments({
            lotId: lot._id,
            status: "OCCUPIED",
        });
        expect(occupiedSlots).toBe(10);
    });

    it("sessions are linked to registered users", async () => {
        // Enter all vehicles
        for (const u of users) {
            await request(app)
                .post("/api/parking/entry")
                .send({ plateNumber: u.plate, lotId: lot._id, vehicleType: u.vehicleType });
        }

        // Verify each session has the correct userId
        for (const u of users) {
            const session = await ParkingSession.findOne({
                plateNumber: u.plate,
                status: "IN",
            });
            expect(session).not.toBeNull();
            expect(session.userId.toString()).toBe(u.user._id.toString());
        }
    });

    it("full flow: entry → park 90 min → exit → fare deducted from wallet", async () => {
        const results = [];

        // ── ENTRY ──
        for (const u of users) {
            const res = await request(app)
                .post("/api/parking/entry")
                .send({ plateNumber: u.plate, lotId: lot._id, vehicleType: u.vehicleType });

            expect(res.body.success).toBe(true);
            results.push({ ...u, sessionId: res.body.data.sessionId });
        }

        // ── SIMULATE PARKING DURATION ──
        // Backdate all entry times by 90 minutes
        for (const r of results) {
            await ParkingSession.findByIdAndUpdate(r.sessionId, {
                entryTime: new Date(Date.now() - PARKING_DURATION_MINUTES * 60 * 1000),
            });
        }

        // ── EXIT ──
        for (const r of results) {
            const res = await request(app)
                .post("/api/parking/exit")
                .send({ plateNumber: r.plate, lotId: lot._id });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.action).toBe("OPEN_EXIT_GATE");
            expect(res.body.data.durationMinutes).toBeGreaterThanOrEqual(PARKING_DURATION_MINUTES);
            expect(res.body.data.fare).toBeGreaterThan(0);
            expect(res.body.data.paymentStatus).toBe("PAID");
        }

        // ── VERIFY WALLETS ──
        // With ratePerHour=60, freeMinutes=15, parking≈90min:
        // billable ≈ 75 min → fare ≈ 75 (±1 due to test execution timing)
        for (const r of results) {
            const wallet = await Wallet.findOne({ userId: r.user._id });
            const deducted = WALLET_TOPUP - wallet.balance;
            expect(deducted).toBeGreaterThanOrEqual(75);
            expect(deducted).toBeLessThanOrEqual(80);

            // Verify a DEBIT transaction was recorded
            const debitTx = wallet.transactions.find((t) => t.type === "DEBIT");
            expect(debitTx).toBeDefined();
            expect(debitTx.amount).toBe(deducted);
            expect(debitTx.description).toBe("Parking fare");
        }

        // ── VERIFY ALL SESSIONS CLOSED ──
        const activeSessions = await ParkingSession.countDocuments({ status: "IN" });
        expect(activeSessions).toBe(0);

        const closedSessions = await ParkingSession.countDocuments({ status: "OUT" });
        expect(closedSessions).toBe(10);

        // ── VERIFY ALL SLOTS RELEASED ──
        const occupiedSlots = await ParkingSlot.countDocuments({
            lotId: lot._id,
            status: "OCCUPIED",
        });
        expect(occupiedSlots).toBe(0);
    });

    it("wallet has insufficient balance → paymentStatus is UNPAID", async () => {
        // Drain one user's wallet
        const poorUser = users[0];
        await Wallet.findOneAndUpdate(
            { userId: poorUser.user._id },
            { balance: 0 }
        );

        // Entry
        const entryRes = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: poorUser.plate, lotId: lot._id, vehicleType: poorUser.vehicleType });

        expect(entryRes.body.success).toBe(true);

        // Backdate by 2 hours
        await ParkingSession.findByIdAndUpdate(entryRes.body.data.sessionId, {
            entryTime: new Date(Date.now() - 120 * 60 * 1000),
        });

        // Exit
        const exitRes = await request(app)
            .post("/api/parking/exit")
            .send({ plateNumber: poorUser.plate, lotId: lot._id });

        expect(exitRes.body.success).toBe(true);
        expect(exitRes.body.data.fare).toBeGreaterThan(0);
        expect(exitRes.body.data.paymentStatus).toBe("UNPAID");

        // Wallet should still be 0
        const wallet = await Wallet.findOne({ userId: poorUser.user._id });
        expect(wallet.balance).toBe(0);
    });

    it("parking within free window → fare is 0, wallet untouched", async () => {
        const luckyUser = users[1];

        // Entry
        const entryRes = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: luckyUser.plate, lotId: lot._id, vehicleType: luckyUser.vehicleType });

        // Backdate by only 10 minutes (within 15-min free window)
        await ParkingSession.findByIdAndUpdate(entryRes.body.data.sessionId, {
            entryTime: new Date(Date.now() - 10 * 60 * 1000),
        });

        // Exit
        const exitRes = await request(app)
            .post("/api/parking/exit")
            .send({ plateNumber: luckyUser.plate, lotId: lot._id });

        expect(exitRes.body.data.fare).toBe(0);
        expect(exitRes.body.data.paymentStatus).toBe("PAID");

        // Wallet unchanged
        const wallet = await Wallet.findOne({ userId: luckyUser.user._id });
        expect(wallet.balance).toBe(WALLET_TOPUP);
    });
});
