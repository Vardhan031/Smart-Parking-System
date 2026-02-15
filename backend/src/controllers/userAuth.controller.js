const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const ParkingSession = require("../models/ParkingSession");
const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");





// 🔐 REGISTER
exports.register = async (req, res) => {
    try {
        const { name, phone, email, password } = req.body;

        if (!name || !phone || !password) {
            return res.status(400).json({ message: "Required fields missing" });
        }

        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            phone,
            email,
            passwordHash,
        });

        res.status(201).json({
            message: "User registered successfully",
            userId: user._id,
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};


// 🔐 LOGIN
exports.login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        const user = await User.findOne({ phone });

        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        if (!user.active) {
            return res.status(403).json({ message: "Account disabled" });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            {
                id: user._id,
                role: "USER",
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
            },
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// 🚗 ADD VEHICLE
exports.addVehicle = async (req, res) => {
    try {
        const { plate } = req.body;

        if (!plate) {
            return res.status(400).json({ message: "Plate number required" });
        }

        const user = await User.findById(req.user.id);

        const formattedPlate = plate.toUpperCase().trim();

        if (user.vehiclePlates.includes(formattedPlate)) {
            return res.status(400).json({ message: "Vehicle already linked" });
        }

        user.vehiclePlates.push(formattedPlate);
        await user.save();

        res.json({ message: "Vehicle linked successfully" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};


// 🚗 REMOVE VEHICLE
exports.removeVehicle = async (req, res) => {
    try {
        const plate = req.params.plate.toUpperCase().trim();

        const user = await User.findById(req.user.id);

        user.vehiclePlates = user.vehiclePlates.filter(
            (p) => p !== plate
        );

        await user.save();

        res.json({ message: "Vehicle removed successfully" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// 💳 GET WALLET
exports.getWallet = async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ userId: req.user.id });

        if (!wallet) {
            return res.json({
                balance: 0,
                transactions: []
            });
        }

        res.json({
            balance: wallet.balance,
            transactions: wallet.transactions
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// 🚗 GET ACTIVE SESSION
exports.getActiveSession = async (req, res) => {
    try {
        const session = await ParkingSession.findOne({
            userId: req.user.id,
            status: "IN"
        }).populate("lotId", "name location");

        if (!session) {
            return res.json({ active: false });
        }

        res.json({
            active: true,
            session
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// 📜 GET SESSION HISTORY
exports.getSessionHistory = async (req, res) => {
    try {
        const sessions = await ParkingSession.find({
            userId: req.user.id,
            status: "OUT"
        })
            .sort({ exitTime: -1 })
            .populate("lotId", "name location");

        res.json({
            count: sessions.length,
            sessions
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

// 💰 TOP UP WALLET
exports.topUpWallet = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        let wallet = await Wallet.findOne({ userId: req.user.id });

        // Create wallet if not exists
        if (!wallet) {
            wallet = await Wallet.create({
                userId: req.user.id,
                balance: 0,
                transactions: []
            });
        }

        wallet.balance += amount;

        wallet.transactions.push({
            type: "CREDIT",
            amount,
            description: "Wallet Top-Up"
        });

        await wallet.save();

        res.json({
            message: "Wallet topped up successfully",
            balance: wallet.balance
        });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};


// 🏢 GET ALL LOTS WITH REAL-TIME AVAILABILITY
exports.getLots = async (req, res) => {
    try {

        const lots = await ParkingLot.find();

        const result = [];

        for (const lot of lots) {

            const totalSlots = await ParkingSlot.countDocuments({
                lotId: lot._id
            });

            const availableSlots = await ParkingSlot.countDocuments({
                lotId: lot._id,
                status: "AVAILABLE"
            });

            const occupiedSlots = totalSlots - availableSlots;

            const occupancyPercentage = totalSlots > 0
                ? Math.round((occupiedSlots / totalSlots) * 100)
                : 0;

            result.push({
                _id: lot._id,
                name: lot.name,
                location: lot.location,
                totalSlots,
                availableSlots,
                occupiedSlots,
                occupancyPercentage
            });
        }

        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// 🏢 GET LOT DETAILS BY ID
exports.getLotById = async (req, res) => {
    try {
        const { id } = req.params;

        const lot = await ParkingLot.findById(id);

        if (!lot) {
            return res.status(404).json({ message: "Lot not found" });
        }

        const slots = await ParkingSlot.find({ lotId: id });

        const totalSlots = slots.length;
        const availableSlots = slots.filter(s => s.status === "AVAILABLE").length;
        const occupiedSlots = totalSlots - availableSlots;

        const occupancyPercentage = totalSlots > 0
            ? Math.round((occupiedSlots / totalSlots) * 100)
            : 0;

        // Vehicle type breakdown
        const slotBreakdown = {};

        for (const slot of slots) {
            const type = slot.vehicleType || "CAR";

            if (!slotBreakdown[type]) {
                slotBreakdown[type] = {
                    total: 0,
                    available: 0
                };
            }

            slotBreakdown[type].total += 1;

            if (slot.status === "AVAILABLE") {
                slotBreakdown[type].available += 1;
            }
        }

        res.json({
            _id: lot._id,
            name: lot.name,
            location: lot.location,
            totalSlots,
            availableSlots,
            occupiedSlots,
            occupancyPercentage,
            slotBreakdown
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// 🅿️ GET ALL SLOTS OF A LOT
exports.getLotSlots = async (req, res) => {
    try {
        const { id } = req.params;

        const slots = await ParkingSlot.find({ lotId: id })
            .sort({ slotNumber: 1 });

        if (!slots.length) {
            return res.json({
                lotId: id,
                total: 0,
                available: 0,
                occupied: 0,
                slots: []
            });
        }

        const total = slots.length;
        const available = slots.filter(s => s.status === "AVAILABLE").length;
        const occupied = total - available;

        res.json({
            lotId: id,
            total,
            available,
            occupied,
            slots
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};
