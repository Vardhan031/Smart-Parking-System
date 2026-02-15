const request = require("supertest");
const db = require("./db");
const createApp = require("./app");
const { createUser, createWallet } = require("./helpers");

const app = createApp();

beforeAll(async () => await db.connect());
afterEach(async () => await db.cleanup());
afterAll(async () => await db.disconnect());

describe("GET /api/user/wallet", () => {
    it("auto-creates wallet for new user", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .get("/api/user/wallet")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.balance).toBe(0);
        expect(res.body.data.transactions).toEqual([]);
    });

    it("returns existing wallet balance", async () => {
        const { user, token } = await createUser();
        await createWallet(user._id, 250);

        const res = await request(app)
            .get("/api/user/wallet")
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data.balance).toBe(250);
    });

    it("returns 401 without token", async () => {
        const res = await request(app).get("/api/user/wallet");
        expect(res.status).toBe(401);
    });
});

describe("POST /api/user/wallet/topup", () => {
    it("creates a pending CREDIT transaction", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post("/api/user/wallet/topup")
            .set("Authorization", `Bearer ${token}`)
            .send({ amount: 200 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.orderId).toBeDefined();
        expect(res.body.data.amount).toBe(200);
        expect(res.body.data.status).toBe("PENDING");
    });

    it("returns 400 for zero or negative amount", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post("/api/user/wallet/topup")
            .set("Authorization", `Bearer ${token}`)
            .send({ amount: 0 });

        expect(res.status).toBe(400);
    });

    it("returns 400 for non-number amount", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post("/api/user/wallet/topup")
            .set("Authorization", `Bearer ${token}`)
            .send({ amount: "abc" });

        expect(res.status).toBe(400);
    });
});

describe("POST /api/user/wallet/verify-payment", () => {
    it("credits wallet balance after verification", async () => {
        const { user, token } = await createUser();

        // First create a top-up order
        const topUpRes = await request(app)
            .post("/api/user/wallet/topup")
            .set("Authorization", `Bearer ${token}`)
            .send({ amount: 300 });

        const orderId = topUpRes.body.data.orderId;

        // Then verify it
        const res = await request(app)
            .post("/api/user/wallet/verify-payment")
            .set("Authorization", `Bearer ${token}`)
            .send({ orderId, paymentId: "pay_test_123" });

        expect(res.status).toBe(200);
        expect(res.body.data.balance).toBe(300);
    });

    it("returns 400 when orderId is missing", async () => {
        const { token } = await createUser();

        const res = await request(app)
            .post("/api/user/wallet/verify-payment")
            .set("Authorization", `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/orderId/i);
    });

    it("returns 404 for invalid orderId", async () => {
        const { user, token } = await createUser();
        await createWallet(user._id);

        const res = await request(app)
            .post("/api/user/wallet/verify-payment")
            .set("Authorization", `Bearer ${token}`)
            .send({ orderId: "000000000000000000000000" });

        expect(res.status).toBe(404);
    });
});
