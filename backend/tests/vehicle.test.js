const request = require("supertest");
const db = require("./db");
const createApp = require("./app");
const { createUser, createLot, createSlots } = require("./helpers");
const ParkingSession = require("../src/models/ParkingSession");

const app = createApp();

beforeAll(async () => await db.connect());
afterEach(async () => await db.cleanup());
afterAll(async () => await db.disconnect());

describe("POST /api/user/vehicles", () => {
    it("links a valid plate to user", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post("/api/user/vehicles")
            .set("Authorization", `Bearer ${token}`)
            .send({ plateNumber: "KA01AB1234" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.vehiclePlates).toContain("KA01AB1234");
    });

    it("normalizes plate (strips spaces/dashes, uppercases)", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post("/api/user/vehicles")
            .set("Authorization", `Bearer ${token}`)
            .send({ plateNumber: "ka-01 ab 5678" });

        expect(res.body.data.vehiclePlates).toContain("KA01AB5678");
    });

    it("returns 400 for missing plateNumber", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post("/api/user/vehicles")
            .set("Authorization", `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
    });

    it("returns 400 for invalid plate format (too short)", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post("/api/user/vehicles")
            .set("Authorization", `Bearer ${token}`)
            .send({ plateNumber: "AB" });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/invalid/i);
    });

    it("returns 409 if plate linked to another user", async () => {
        await createUser({ vehiclePlates: ["KA01DUP001"] });
        const { token: token2 } = await createUser({ email: "other@test.com" });

        const res = await request(app)
            .post("/api/user/vehicles")
            .set("Authorization", `Bearer ${token2}`)
            .send({ plateNumber: "KA01DUP001" });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/another account/i);
    });

    it("does not duplicate if plate already linked to same user", async () => {
        const { token } = await createUser({ vehiclePlates: ["KA01AB1234"] });

        const res = await request(app)
            .post("/api/user/vehicles")
            .set("Authorization", `Bearer ${token}`)
            .send({ plateNumber: "KA01AB1234" });

        expect(res.status).toBe(200);
        // $addToSet prevents duplicates
        const plates = res.body.data.vehiclePlates.filter((p) => p === "KA01AB1234");
        expect(plates.length).toBe(1);
    });
});

describe("DELETE /api/user/vehicles/:plate", () => {
    it("unlinks a plate from user", async () => {
        const { token } = await createUser({ vehiclePlates: ["KA01RM0001"] });

        const res = await request(app)
            .delete("/api/user/vehicles/KA01RM0001")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.vehiclePlates).not.toContain("KA01RM0001");
    });

    it("returns 400 when vehicle has active parking session", async () => {
        const { user, token } = await createUser({ vehiclePlates: ["KA01AC0001"] });
        const lot = await createLot();
        await createSlots(lot._id, 2);

        // Create an active session for this plate
        await ParkingSession.create({
            plateNumber: "KA01AC0001",
            lotId: lot._id,
            slotNumber: 1,
            status: "IN",
            userId: user._id,
        });

        const res = await request(app)
            .delete("/api/user/vehicles/KA01AC0001")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/active/i);
    });

    it("returns 401 without auth", async () => {
        const res = await request(app).delete("/api/user/vehicles/KA01XX0001");
        expect(res.status).toBe(401);
    });
});
