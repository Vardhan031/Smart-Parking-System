const request = require("supertest");
const db = require("./db");
const createApp = require("./app");
const { createLot, createSlots, createUser, createWallet } = require("./helpers");
const ParkingSlot = require("../src/models/ParkingSlot");
const ParkingSession = require("../src/models/ParkingSession");

const app = createApp();

beforeAll(async () => await db.connect());
afterEach(async () => await db.cleanup());
afterAll(async () => await db.disconnect());

describe("POST /api/parking/entry", () => {
    it("allows entry and assigns a slot", async () => {
        const lot = await createLot();
        await createSlots(lot._id, 3);

        const res = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01AB1234", lotId: lot._id });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.action).toBe("OPEN_ENTRY_GATE");
        expect(res.body.data.slotNumber).toBe(1);
        expect(res.body.data.sessionId).toBeDefined();

        // Slot should now be occupied
        const slot = await ParkingSlot.findOne({ lotId: lot._id, slotNumber: 1 });
        expect(slot.status).toBe("OCCUPIED");
    });

    it("returns 400 when plateNumber or lotId missing", async () => {
        const res = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01AB1234" });

        expect(res.status).toBe(400);
    });

    it("denies entry for a vehicle already parked", async () => {
        const lot = await createLot();
        await createSlots(lot._id, 3);

        await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01AB9999", lotId: lot._id });

        const res = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01AB9999", lotId: lot._id });

        expect(res.status).toBe(409);
        expect(res.body.action).toBe("DENY_ENTRY");
    });

    it("denies entry when parking is full", async () => {
        const lot = await createLot();
        await createSlots(lot._id, 1);

        // Fill the only slot
        await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01AA0001", lotId: lot._id });

        const res = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01AA0002", lotId: lot._id });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/full/i);
    });

    it("links session to registered user by plate", async () => {
        const lot = await createLot();
        await createSlots(lot._id, 3);
        await createUser({ vehiclePlates: ["KA01XX1111"] });

        const res = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01XX1111", lotId: lot._id });

        expect(res.body.success).toBe(true);

        const session = await ParkingSession.findById(res.body.data.sessionId);
        expect(session.userId).not.toBeNull();
    });
});

describe("POST /api/parking/exit", () => {
    it("allows exit and calculates fare", async () => {
        const lot = await createLot({ pricing: { ratePerHour: 60, freeMinutes: 0 } });
        await createSlots(lot._id, 3);

        // Enter
        const entryRes = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01EX0001", lotId: lot._id });

        // Backdate entry time by 30 minutes to get a non-zero fare
        await ParkingSession.findByIdAndUpdate(
            entryRes.body.data.sessionId,
            { entryTime: new Date(Date.now() - 30 * 60 * 1000) }
        );

        const res = await request(app)
            .post("/api/parking/exit")
            .send({ plateNumber: "KA01EX0001", lotId: lot._id });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.action).toBe("OPEN_EXIT_GATE");
        expect(res.body.data.durationMinutes).toBeGreaterThanOrEqual(30);
        expect(res.body.data.fare).toBeGreaterThan(0);
    });

    it("returns 404 if no active session", async () => {
        const lot = await createLot();
        await createSlots(lot._id, 1);

        const res = await request(app)
            .post("/api/parking/exit")
            .send({ plateNumber: "KA01NONE00", lotId: lot._id });

        expect(res.status).toBe(404);
    });

    it("releases the slot after exit", async () => {
        const lot = await createLot();
        await createSlots(lot._id, 2);

        await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01RL0001", lotId: lot._id });

        await request(app)
            .post("/api/parking/exit")
            .send({ plateNumber: "KA01RL0001", lotId: lot._id });

        const slot = await ParkingSlot.findOne({ lotId: lot._id, slotNumber: 1 });
        expect(slot.status).toBe("AVAILABLE");
        expect(slot.currentSession).toBeNull();
    });

    it("fare is 0 within freeMinutes window", async () => {
        const lot = await createLot({ pricing: { ratePerHour: 60, freeMinutes: 60 } });
        await createSlots(lot._id, 2);

        const entryRes = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01FR0001", lotId: lot._id });

        // Backdate by only 5 minutes (within 60 min free window)
        await ParkingSession.findByIdAndUpdate(
            entryRes.body.data.sessionId,
            { entryTime: new Date(Date.now() - 5 * 60 * 1000) }
        );

        const res = await request(app)
            .post("/api/parking/exit")
            .send({ plateNumber: "KA01FR0001", lotId: lot._id });

        expect(res.body.data.fare).toBe(0);
    });

    it("deducts fare from wallet for linked user", async () => {
        const lot = await createLot({ pricing: { ratePerHour: 120, freeMinutes: 0 } });
        await createSlots(lot._id, 2);
        const { user } = await createUser({ vehiclePlates: ["KA01WL0001"] });
        await createWallet(user._id, 500);

        const entryRes = await request(app)
            .post("/api/parking/entry")
            .send({ plateNumber: "KA01WL0001", lotId: lot._id });

        // Backdate by 60 minutes → fare = 120
        await ParkingSession.findByIdAndUpdate(
            entryRes.body.data.sessionId,
            { entryTime: new Date(Date.now() - 60 * 60 * 1000) }
        );

        const res = await request(app)
            .post("/api/parking/exit")
            .send({ plateNumber: "KA01WL0001", lotId: lot._id });

        expect(res.body.data.paymentStatus).toBe("PAID");

        const Wallet = require("../src/models/Wallet");
        const wallet = await Wallet.findOne({ userId: user._id });
        expect(wallet.balance).toBeLessThan(500);
    });
});
