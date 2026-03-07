/**
 * 🎯 Demo Seed Script
 *
 * Sets up everything needed for a live demo:
 *   - Admin user (for the Admin Portal)
 *   - Demo user with vehicle plate (for the Mobile App)
 *   - Parking lot with slots
 *   - Wallet with ₹500 balance
 *
 * Run:  cd backend && node src/utils/seedDemo.js
 *
 * Safe to run multiple times — skips items that already exist.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const AdminUser = require("../models/AdminUser");
const User = require("../models/User");
const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");
const Wallet = require("../models/Wallet");

// ── Config ──────────────────────────────────────────────────
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const USER_NAME = "Demo User";
const USER_EMAIL = "demo@smartpark.com";
const USER_PASSWORD = "demo123";
const USER_PLATE = "KA01AB1234";

const LOT_NAME = "SmartPark Main Lot";
const LOT_CODE = "SP-MAIN";
const LOT_TOTAL_SLOTS = 20;
const LOT_RATE_PER_HOUR = 30;
const LOT_FREE_MINUTES = 15;

const WALLET_INITIAL_BALANCE = 500;

// ── Main ────────────────────────────────────────────────────
async function seedDemo() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB\n");

        // 1️⃣  Admin
        let admin = await AdminUser.findOne({ username: ADMIN_USERNAME });
        if (!admin) {
            const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
            admin = await AdminUser.create({
                username: ADMIN_USERNAME,
                passwordHash: hash,
            });
            console.log("🔑 Admin created");
        } else {
            console.log("🔑 Admin already exists");
        }

        // 2️⃣  User
        let user = await User.findOne({ email: USER_EMAIL });
        if (!user) {
            const hash = await bcrypt.hash(USER_PASSWORD, 10);
            user = await User.create({
                name: USER_NAME,
                email: USER_EMAIL,
                passwordHash: hash,
                vehiclePlates: [USER_PLATE],
            });
            console.log("👤 User created");
        } else {
            // Ensure plate is linked
            if (!user.vehiclePlates.includes(USER_PLATE)) {
                user.vehiclePlates.push(USER_PLATE);
                await user.save();
            }
            console.log("👤 User already exists");
        }

        // 3️⃣  Parking Lot
        let lot = await ParkingLot.findOne({ code: LOT_CODE });
        if (!lot) {
            lot = await ParkingLot.create({
                name: LOT_NAME,
                code: LOT_CODE,
                totalSlots: LOT_TOTAL_SLOTS,
                active: true,
                location: {
                    address: "Demo Location, Bangalore",
                    latitude: 12.9716,
                    longitude: 77.5946,
                },
                pricing: {
                    ratePerHour: LOT_RATE_PER_HOUR,
                    freeMinutes: LOT_FREE_MINUTES,
                },
            });
            console.log("🅿️  Parking lot created");
        } else {
            console.log("🅿️  Parking lot already exists");
        }

        // 4️⃣  Slots
        const existingSlots = await ParkingSlot.countDocuments({ lotId: lot._id });
        if (existingSlots < LOT_TOTAL_SLOTS) {
            const slotsToCreate = [];
            for (let i = existingSlots + 1; i <= LOT_TOTAL_SLOTS; i++) {
                slotsToCreate.push({
                    lotId: lot._id,
                    slotNumber: i,
                    status: "AVAILABLE",
                    vehicleType: "CAR",
                });
            }
            if (slotsToCreate.length > 0) {
                await ParkingSlot.insertMany(slotsToCreate);
                console.log(`🔲 Created ${slotsToCreate.length} slots`);
            }
        } else {
            console.log(`🔲 All ${LOT_TOTAL_SLOTS} slots already exist`);
        }

        // 5️⃣  Wallet
        let wallet = await Wallet.findOne({ userId: user._id });
        if (!wallet) {
            wallet = await Wallet.create({
                userId: user._id,
                balance: WALLET_INITIAL_BALANCE,
                transactions: [
                    {
                        type: "CREDIT",
                        amount: WALLET_INITIAL_BALANCE,
                        description: "Initial demo balance",
                        createdAt: new Date(),
                    },
                ],
            });
            console.log("💰 Wallet created");
        } else {
            console.log("💰 Wallet already exists");
        }

        // ── Summary ─────────────────────────────────────────
        console.log("\n" + "═".repeat(50));
        console.log("  DEMO READY — Credentials & IDs");
        console.log("═".repeat(50));
        console.log(`\n  Admin Portal Login:`);
        console.log(`    Username : ${ADMIN_USERNAME}`);
        console.log(`    Password : ${ADMIN_PASSWORD}`);
        console.log(`\n  Mobile App Login:`);
        console.log(`    Email    : ${USER_EMAIL}`);
        console.log(`    Password : ${USER_PASSWORD}`);
        console.log(`    Plate    : ${USER_PLATE}`);
        console.log(`\n  Parking Lot:`);
        console.log(`    Name     : ${lot.name}`);
        console.log(`    Code     : ${lot.code}`);
        console.log(`    Lot ID   : ${lot._id}`);
        console.log(`    Slots    : ${LOT_TOTAL_SLOTS}`);
        console.log(`    Rate     : ₹${LOT_RATE_PER_HOUR}/hr (${LOT_FREE_MINUTES} min free)`);
        console.log(`\n  Wallet:`);
        console.log(`    Balance  : ₹${wallet.balance}`);
        console.log(`\n${"═".repeat(50)}\n`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    }
}

seedDemo();
