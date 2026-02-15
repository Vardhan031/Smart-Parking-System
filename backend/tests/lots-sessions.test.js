const request = require("supertest");
const mongoose = require("mongoose");
const db = require("./db");
const createApp = require("./app");
const { createUser, createLot, createSlots } = require("./helpers");
const ParkingSession = require("../src/models/ParkingSession");

const app = createApp();

beforeAll(async () => await db.connect());
afterEach(async () => await db.cleanup());
afterAll(async () => await db.disconnect());

// ─── Lot listing ────────────────────────────────────────────

describe("GET /api/user/lots", () => {
    it("returns active lots with availability counts", async () => {
        const lot = await createLot({ name: "Central Lot" });
        await createSlots(lot._id, 5);
        // Inactive lot should not appear
        await createLot({ name: "Closed Lot", code: "CLOSED1", active: false });

        const res = await request(app).get("/api/user/lots");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].name).toBe("Central Lot");
        expect(res.body.data[0].availableSlots).toBe(5);
    });

    it("returns empty array when no active lots", async () => {
        const res = await request(app).get("/api/user/lots");

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });

    it("sorts by proximity when lat/lng provided", async () => {
        // Lot A: Bangalore (12.97, 77.59)
        await createLot({
            name: "Bangalore Lot",
            code: "BLR1",
            location: { latitude: 12.97, longitude: 77.59, address: "BLR" },
        });
        // Lot B: Delhi (28.61, 77.23)
        await createLot({
            name: "Delhi Lot",
            code: "DEL1",
            location: { latitude: 28.61, longitude: 77.23, address: "DEL" },
        });

        // User near Bangalore
        const res = await request(app)
            .get("/api/user/lots")
            .query({ lat: 12.97, lng: 77.59 });

        expect(res.body.data[0].name).toBe("Bangalore Lot");
        expect(res.body.data[1].name).toBe("Delhi Lot");
    });
});

// ─── Lot detail ─────────────────────────────────────────────

describe("GET /api/user/lots/:id", () => {
    it("returns lot with slot breakdown", async () => {
        const lot = await createLot();
        await createSlots(lot._id, 3, "CAR");

        // Manually create BIKE slots with different slot numbers to avoid duplicates
        const ParkingSlot = require("../src/models/ParkingSlot");
        await ParkingSlot.insertMany([
            { lotId: lot._id, slotNumber: 100, vehicleType: "BIKE", status: "AVAILABLE" },
            { lotId: lot._id, slotNumber: 101, vehicleType: "BIKE", status: "AVAILABLE" },
        ]);

        const bikeSlots = await ParkingSlot.find({ lotId: lot._id, vehicleType: "BIKE" });
        expect(bikeSlots.length).toBe(2);

        const res = await request(app).get(`/api/user/lots/${lot._id}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe(lot.name);
        expect(res.body.data.slots).toBeDefined();
        expect(res.body.data.slots.length).toBe(2); // CAR + BIKE

        const carSlots = res.body.data.slots.find((s) => s.vehicleType === "CAR");
        expect(carSlots.available).toBe(3);
        expect(carSlots.total).toBe(3);
    });

    it("returns 404 for non-existent lot", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app).get(`/api/user/lots/${fakeId}`);
        expect(res.status).toBe(404);
    });

    it("returns 404 for inactive lot", async () => {
        const lot = await createLot({ active: false });
        const res = await request(app).get(`/api/user/lots/${lot._id}`);
        expect(res.status).toBe(404);
    });
});

// ─── Active session ─────────────────────────────────────────

describe("GET /api/user/sessions/active", () => {
    it("returns null when no active session", async () => {
        const { token } = await createUser({ vehiclePlates: ["KA01AA0001"] });

        const res = await request(app)
            .get("/api/user/sessions/active")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toBeNull();
    });

    it("returns the active session for user's plate", async () => {
        const { user, token } = await createUser({ vehiclePlates: ["KA01AA0002"] });
        const lot = await createLot();

        await ParkingSession.create({
            plateNumber: "KA01AA0002",
            lotId: lot._id,
            slotNumber: 1,
            status: "IN",
            userId: user._id,
        });

        const res = await request(app)
            .get("/api/user/sessions/active")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data).not.toBeNull();
        expect(res.body.data.plateNumber).toBe("KA01AA0002");
        expect(res.body.data.status).toBe("IN");
    });

    it("returns null for user with no vehicles", async () => {
        const { token } = await createUser({ vehiclePlates: [] });

        const res = await request(app)
            .get("/api/user/sessions/active")
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data).toBeNull();
    });
});

// ─── Session history ────────────────────────────────────────

describe("GET /api/user/sessions/history", () => {
    it("returns paginated completed sessions", async () => {
        const { user, token } = await createUser({ vehiclePlates: ["KA01HI0001"] });
        const lot = await createLot();

        // Create 3 completed sessions
        for (let i = 0; i < 3; i++) {
            await ParkingSession.create({
                plateNumber: "KA01HI0001",
                lotId: lot._id,
                slotNumber: i + 1,
                status: "OUT",
                userId: user._id,
                entryTime: new Date(Date.now() - (i + 1) * 3600000),
                exitTime: new Date(Date.now() - i * 3600000),
                durationMinutes: 60,
                fare: 60,
                paymentStatus: "PAID",
            });
        }

        const res = await request(app)
            .get("/api/user/sessions/history")
            .set("Authorization", `Bearer ${token}`)
            .query({ page: 1, limit: 2 });

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(2);
        expect(res.body.pagination.total).toBe(3);
        expect(res.body.pagination.page).toBe(1);
    });

    it("does not return active (IN) sessions in history", async () => {
        const { user, token } = await createUser({ vehiclePlates: ["KA01HI0002"] });
        const lot = await createLot();

        await ParkingSession.create({
            plateNumber: "KA01HI0002",
            lotId: lot._id,
            slotNumber: 1,
            status: "IN",
            userId: user._id,
        });

        const res = await request(app)
            .get("/api/user/sessions/history")
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data.length).toBe(0);
    });

    it("returns empty for user with no plates", async () => {
        const { token } = await createUser({ vehiclePlates: [] });

        const res = await request(app)
            .get("/api/user/sessions/history")
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data).toEqual([]);
        expect(res.body.pagination.total).toBe(0);
    });
});
