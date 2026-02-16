/**
 * ANPR Seed Script
 * ─────────────────
 * Populates the REAL database with:
 *   - 1 Admin user (for dashboard login)
 *   - 1 Parking lot + 15 slots (10 CAR + 5 BIKE)
 *   - 10 Users with plates from ANPR camera images
 *   - Wallets topped up with ₹1000 each
 *   - Parking sessions: 4 currently parked (IN), 6 completed (OUT) with fares
 *   - Wallet debits for completed sessions
 *
 * Run:  node src/utils/seedANPR.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const AdminUser = require("../models/AdminUser");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingSession = require("../models/ParkingSession");

// ── Config ──
const WALLET_TOPUP = 1000;
const DEFAULT_PASSWORD = "parking@123"; // All seed users share this password

const USERS = [
    { name: "Ravi Kumar",    email: "ravi.kumar@smartpark.in",    phone: "9876543201", plate: "TS08FR4989", vehicleType: "CAR"  },
    { name: "Sneha Reddy",   email: "sneha.reddy@smartpark.in",   phone: "9876543202", plate: "AP25AL4739", vehicleType: "CAR"  },
    { name: "Arjun Rao",     email: "arjun.rao@smartpark.in",     phone: "9876543203", plate: "TS09EJ9509", vehicleType: "CAR"  },
    { name: "Priya Sharma",  email: "priya.sharma@smartpark.in",  phone: "9876543204", plate: "TS07EG5768", vehicleType: "CAR"  },
    { name: "Vikram Singh",  email: "vikram.singh@smartpark.in",  phone: "9876543205", plate: "TS07JE1214", vehicleType: "CAR"  },
    { name: "Meena Devi",    email: "meena.devi@smartpark.in",    phone: "9876543206", plate: "AP28CE5390", vehicleType: "CAR"  },
    { name: "Rahul Verma",   email: "rahul.verma@smartpark.in",   phone: "9876543207", plate: "TS07HL1882", vehicleType: "CAR"  },
    { name: "Amit Patil",    email: "amit.patil@smartpark.in",    phone: "9876543208", plate: "MH26CH0480", vehicleType: "CAR"  },
    { name: "Sanjay Jadhav", email: "sanjay.jadhav@smartpark.in", phone: "9876543209", plate: "MH26AK0328", vehicleType: "BIKE" },
    { name: "Kiran Goud",    email: "kiran.goud@smartpark.in",    phone: "9876543210", plate: "TS08CH8182", vehicleType: "BIKE" },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to", process.env.MONGO_URI);

        // ════════════════════════════════════════
        // 1️⃣  ADMIN
        // ════════════════════════════════════════
        let admin = await AdminUser.findOne({ username: "admin" });
        if (!admin) {
            const hash = await bcrypt.hash("admin123", 10);
            admin = await AdminUser.create({ username: "admin", passwordHash: hash });
            console.log("👤 Admin created  →  username: admin  |  password: admin123");
        } else {
            console.log("👤 Admin already exists");
        }

        // ════════════════════════════════════════
        // 2️⃣  PARKING LOT + SLOTS
        // ════════════════════════════════════════
        let lot = await ParkingLot.findOne({ code: "HYD-MAIN-01" });
        if (!lot) {
            lot = await ParkingLot.create({
                name: "Hyderabad Central Parking",
                code: "HYD-MAIN-01",
                totalSlots: 15,
                active: true,
                pricing: { ratePerHour: 60, freeMinutes: 15 },
                location: {
                    address: "Survey No. 42, NH-65, Hyderabad, Telangana",
                    latitude: 17.385,
                    longitude: 78.4867,
                },
            });
            console.log("🅿️  Parking lot created:", lot.name);

            // 10 CAR slots (1-10) + 5 BIKE slots (11-15)
            const slots = [];
            for (let i = 1; i <= 10; i++) {
                slots.push({ lotId: lot._id, slotNumber: i, vehicleType: "CAR", status: "AVAILABLE" });
            }
            for (let i = 11; i <= 15; i++) {
                slots.push({ lotId: lot._id, slotNumber: i, vehicleType: "BIKE", status: "AVAILABLE" });
            }
            await ParkingSlot.insertMany(slots);
            console.log("🔲 15 slots created (10 CAR + 5 BIKE)");
        } else {
            console.log("🅿️  Parking lot already exists:", lot.name);
        }

        // ════════════════════════════════════════
        // 3️⃣  USERS + WALLETS
        // ════════════════════════════════════════
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        const createdUsers = [];

        for (const u of USERS) {
            let user = await User.findOne({ email: u.email });
            if (!user) {
                user = await User.create({
                    name: u.name,
                    email: u.email,
                    phone: u.phone,
                    passwordHash,
                    vehiclePlates: [u.plate],
                });
            } else {
                // Ensure plate is assigned even if user already existed
                if (!user.vehiclePlates.includes(u.plate)) {
                    user.vehiclePlates.push(u.plate);
                    await user.save();
                }
            }

            // Create / update wallet
            let wallet = await Wallet.findOne({ userId: user._id });
            if (!wallet) {
                wallet = await Wallet.create({
                    userId: user._id,
                    balance: WALLET_TOPUP,
                    transactions: [
                        {
                            type: "CREDIT",
                            amount: WALLET_TOPUP,
                            description: "Wallet top-up",
                            createdAt: new Date(),
                        },
                    ],
                });
            }

            createdUsers.push({ ...u, user, wallet });
        }

        console.log(`👥 ${createdUsers.length} users ready (password for all: ${DEFAULT_PASSWORD})`);
        console.log("💰 Each wallet funded with ₹" + WALLET_TOPUP);

        // ════════════════════════════════════════
        // 4️⃣  PARKING SESSIONS
        // ════════════════════════════════════════
        // First 4 users → currently parked (IN) — shows as active in dashboard
        // Next 6 users  → completed sessions (OUT) — shows as revenue + history

        const now = new Date();

        // ── Active sessions (IN) ──
        for (let i = 0; i < 4; i++) {
            const cu = createdUsers[i];
            const entryMinutesAgo = 20 + i * 15; // 20, 35, 50, 65 minutes ago
            const entryTime = new Date(now.getTime() - entryMinutesAgo * 60 * 1000);

            // Check if this plate already has an active session
            const existing = await ParkingSession.findOne({ plateNumber: cu.plate, status: "IN" });
            if (existing) continue;

            // Find available slot
            const slot = await ParkingSlot.findAvailableSlot(lot._id, cu.vehicleType);
            if (!slot) {
                console.warn(`⚠️  No available ${cu.vehicleType} slot for ${cu.plate}`);
                continue;
            }

            const session = await ParkingSession.create({
                plateNumber: cu.plate,
                lotId: lot._id,
                slotNumber: slot.slotNumber,
                userId: cu.user._id,
                entryTime,
                status: "IN",
            });

            slot.status = "OCCUPIED";
            slot.currentSession = session._id;
            await slot.save();

            console.log(`🚗 IN   ${cu.plate.padEnd(12)} slot ${slot.slotNumber}  (${entryMinutesAgo} min ago)  — ${cu.name}`);
        }

        // ── Completed sessions (OUT) ──
        for (let i = 4; i < 10; i++) {
            const cu = createdUsers[i];
            const entryHoursAgo = 1 + (i - 4) * 0.5; // 1h, 1.5h, 2h, 2.5h, 3h, 3.5h ago
            const parkDurationMin = 30 + (i - 4) * 15; // 30, 45, 60, 75, 90, 105 min
            const entryTime = new Date(now.getTime() - entryHoursAgo * 60 * 60 * 1000);
            const exitTime = new Date(entryTime.getTime() + parkDurationMin * 60 * 1000);

            // Check if session already exists for this plate today
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const existing = await ParkingSession.findOne({
                plateNumber: cu.plate,
                entryTime: { $gte: startOfToday },
            });
            if (existing) continue;

            // Calculate fare: billable = max(0, duration - freeMinutes), fare = ceil(billable/60 * rate)
            const billableMin = Math.max(0, parkDurationMin - lot.pricing.freeMinutes);
            const fare = Math.ceil((billableMin / 60) * lot.pricing.ratePerHour);

            // Pick a slot number (these are completed, so slot is free now)
            const slotNumber = cu.vehicleType === "BIKE" ? 11 + (i - 8) : i - 3;

            const session = await ParkingSession.create({
                plateNumber: cu.plate,
                lotId: lot._id,
                slotNumber,
                userId: cu.user._id,
                entryTime,
                exitTime,
                durationMinutes: parkDurationMin,
                fare,
                paymentStatus: "PAID",
                status: "OUT",
            });

            // Deduct fare from wallet
            if (fare > 0) {
                await Wallet.findOneAndUpdate(
                    { userId: cu.user._id, balance: { $gte: fare } },
                    {
                        $inc: { balance: -fare },
                        $push: {
                            transactions: {
                                type: "DEBIT",
                                amount: fare,
                                description: "Parking fare",
                                reference: String(session._id),
                                createdAt: exitTime,
                            },
                        },
                    }
                );
            }

            console.log(
                `🚗 OUT  ${cu.plate.padEnd(12)} slot ${slotNumber}   ` +
                `${parkDurationMin}min  ₹${String(fare).padStart(3)}  — ${cu.name}`
            );
        }

        // ════════════════════════════════════════
        // 📊  SUMMARY
        // ════════════════════════════════════════
        const totalActive = await ParkingSession.countDocuments({ status: "IN" });
        const totalCompleted = await ParkingSession.countDocuments({ status: "OUT" });
        const occupiedSlots = await ParkingSlot.countDocuments({ lotId: lot._id, status: "OCCUPIED" });
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const revenueAgg = await ParkingSession.aggregate([
            { $match: { exitTime: { $gte: todayStart }, fare: { $ne: null } } },
            { $group: { _id: null, total: { $sum: "$fare" } } },
        ]);
        const todayRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

        console.log("\n════════════════════════════════════════");
        console.log("📊 SEED COMPLETE");
        console.log("════════════════════════════════════════");
        console.log(`🅿️  Lot:            ${lot.name} (${lot.code})`);
        console.log(`🔲 Slots:           ${occupiedSlots} occupied / 15 total`);
        console.log(`👥 Users:           10 (password: ${DEFAULT_PASSWORD})`);
        console.log(`🚗 Active sessions: ${totalActive}`);
        console.log(`✅ Completed:       ${totalCompleted}`);
        console.log(`💰 Today's revenue: ₹${todayRevenue}`);
        console.log("════════════════════════════════════════");
        console.log("\n🔐 Admin login:     username: admin  |  password: admin123");
        console.log("📱 Mobile login:    any email below  |  password: parking@123");
        console.log("");
        for (const cu of createdUsers) {
            const w = await Wallet.findOne({ userId: cu.user._id });
            console.log(`   ${cu.name.padEnd(16)} ${cu.email.padEnd(32)} ${cu.plate}  💰 ₹${w.balance}`);
        }
        console.log("");

        process.exit(0);
    } catch (err) {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    }
}

seed();
