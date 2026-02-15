const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");
const AdminUser = require("../src/models/AdminUser");
const ParkingLot = require("../src/models/ParkingLot");
const ParkingSlot = require("../src/models/ParkingSlot");
const Wallet = require("../src/models/Wallet");

const JWT_SECRET = "test-jwt-secret";

// Set for all test processes
process.env.JWT_SECRET = JWT_SECRET;

function userToken(userId) {
    return jwt.sign({ id: userId, role: "USER" }, JWT_SECRET, { expiresIn: "1h" });
}

function adminToken(adminId) {
    return jwt.sign({ id: adminId, role: "ADMIN" }, JWT_SECRET, { expiresIn: "1h" });
}

async function createUser(overrides = {}) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(overrides.password || "password123", salt);

    const user = await User.create({
        name: "Test User",
        email: `user${Date.now()}@test.com`,
        passwordHash,
        vehiclePlates: [],
        ...overrides,
        passwordHash, // always use hashed version
    });

    const token = userToken(user._id);
    return { user, token };
}

async function createAdmin(overrides = {}) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(overrides.password || "admin123", salt);

    const admin = await AdminUser.create({
        username: `admin${Date.now()}`,
        passwordHash,
        role: "ADMIN",
        ...overrides,
        passwordHash,
    });

    const token = adminToken(admin._id);
    return { admin, token };
}

async function createLot(overrides = {}) {
    return ParkingLot.create({
        name: "Test Lot",
        code: `LOT${Date.now()}`,
        totalSlots: 10,
        pricing: { ratePerHour: 60, freeMinutes: 15 },
        location: { address: "123 Test St", latitude: 12.97, longitude: 77.59 },
        ...overrides,
    });
}

async function createSlots(lotId, count = 5, vehicleType = "CAR") {
    const slots = [];
    for (let i = 1; i <= count; i++) {
        slots.push({ lotId, slotNumber: i, vehicleType, status: "AVAILABLE" });
    }
    return ParkingSlot.insertMany(slots);
}

async function createWallet(userId, balance = 0) {
    return Wallet.create({ userId, balance });
}

module.exports = {
    JWT_SECRET,
    userToken,
    adminToken,
    createUser,
    createAdmin,
    createLot,
    createSlots,
    createWallet,
};
