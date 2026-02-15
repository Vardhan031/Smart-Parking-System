const request = require("supertest");
const db = require("./db");
const createApp = require("./app");
const { createUser } = require("./helpers");

const app = createApp();

beforeAll(async () => await db.connect());
afterEach(async () => await db.cleanup());
afterAll(async () => await db.disconnect());

describe("POST /api/user/auth/register", () => {
    it("creates a new user and returns token", async () => {
        const res = await request(app)
            .post("/api/user/auth/register")
            .send({ name: "John", email: "john@test.com", password: "pass123" });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.name).toBe("John");
        expect(res.body.user.email).toBe("john@test.com");
        expect(res.body.user.vehiclePlates).toEqual([]);
        // password should not be in response
        expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("returns 400 when required fields are missing", async () => {
        const res = await request(app)
            .post("/api/user/auth/register")
            .send({ email: "john@test.com" });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it("returns 409 for duplicate email", async () => {
        await createUser({ email: "dup@test.com" });

        const res = await request(app)
            .post("/api/user/auth/register")
            .send({ name: "Dup", email: "dup@test.com", password: "pass123" });

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/already registered/i);
    });

    it("accepts optional phone and vehiclePlates", async () => {
        const res = await request(app)
            .post("/api/user/auth/register")
            .send({
                name: "Jane",
                email: "jane@test.com",
                password: "pass123",
                phone: "9876543210",
                vehiclePlates: ["KA01AB1234"],
            });

        expect(res.status).toBe(201);
        expect(res.body.user.vehiclePlates).toContain("KA01AB1234");
    });
});

describe("POST /api/user/auth/login", () => {
    it("logs in with correct credentials", async () => {
        await createUser({ email: "login@test.com", password: "secret" });

        const res = await request(app)
            .post("/api/user/auth/login")
            .send({ email: "login@test.com", password: "secret" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe("login@test.com");
    });

    it("returns 401 for wrong password", async () => {
        await createUser({ email: "wrong@test.com", password: "correct" });

        const res = await request(app)
            .post("/api/user/auth/login")
            .send({ email: "wrong@test.com", password: "incorrect" });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it("returns 401 for non-existent email", async () => {
        const res = await request(app)
            .post("/api/user/auth/login")
            .send({ email: "nobody@test.com", password: "pass" });

        expect(res.status).toBe(401);
    });

    it("returns 400 when email or password missing", async () => {
        const res = await request(app)
            .post("/api/user/auth/login")
            .send({ email: "a@b.com" });

        expect(res.status).toBe(400);
    });

    it("returns 401 for inactive user", async () => {
        await createUser({ email: "inactive@test.com", password: "pass", active: false });

        const res = await request(app)
            .post("/api/user/auth/login")
            .send({ email: "inactive@test.com", password: "pass" });

        expect(res.status).toBe(401);
    });
});
