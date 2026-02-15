const ParkingSession = require("../models/ParkingSession");
const ParkingSlot = require("../models/ParkingSlot");
const User = require("../models/User");
const Wallet = require("../models/Wallet");


class ParkingService {

    /**
     * 🚗 ENTRY FLOW
     */
    static async handleEntry({ plateNumber, lotId, vehicleType = "CAR" }) {
        plateNumber = plateNumber.trim().toUpperCase();

        // 1️⃣ Check if vehicle already inside
        const activeSession = await ParkingSession.findOne({
            plateNumber,
            status: "IN"
        });

        if (activeSession) {
            return {
                success: false,
                message: "Vehicle already inside parking",
                action: "DENY_ENTRY"
            };
        }

        // 2️⃣ Find available slot
        const availableSlot = await ParkingSlot.findAvailableSlot(
            lotId,
            vehicleType
        );

        if (!availableSlot) {
            return {
                success: false,
                message: "Parking is full",
                action: "DENY_ENTRY"
            };
        }

        // 🔎 2.5️⃣ Check if plate belongs to registered user
        const linkedUser = await User.findOne({
            vehiclePlates: plateNumber
        });

        // 3️⃣ Create session
        const session = await ParkingSession.create({
            plateNumber,
            userId: linkedUser ? linkedUser._id : null,
            lotId,
            slotNumber: availableSlot.slotNumber,
            entryTime: new Date(),
            status: "IN"
        });

        // 4️⃣ Occupy slot
        availableSlot.status = "OCCUPIED";
        availableSlot.currentSession = session._id;
        await availableSlot.save();

        return {
            success: true,
            message: "Entry allowed",
            action: "OPEN_ENTRY_GATE",
            data: {
                slotNumber: availableSlot.slotNumber,
                sessionId: session._id
            }
        };
    }


    /**
     * 🚗 EXIT FLOW
     */
    static async handleExit({ plateNumber, lotId }) {
        plateNumber = plateNumber.trim().toUpperCase();
        const HOURLY_RATE = 50;

        // 1️⃣ Find active session
        const session = await ParkingSession.findOne({
            plateNumber,
            lotId,
            status: "IN"
        });

        if (!session) {
            return {
                success: false,
                message: "No active parking session found",
                action: "DENY_EXIT"
            };
        }

        // 2️⃣ Set exit details
        session.exitTime = new Date();
        session.status = "OUT";

        await session.save(); // duration auto-calculated

        // 💰 Calculate Fare
        const duration = session.durationMinutes || 0;
        const hours = Math.max(1, Math.ceil(duration / 60));
        const fare = hours * HOURLY_RATE;

        session.fare = fare;

        // 💳 WALLET DEDUCTION
        if (session.userId) {
            const wallet = await Wallet.findOne({ userId: session.userId });

            if (wallet && wallet.balance >= fare) {
                wallet.balance -= fare;

                wallet.transactions.push({
                    type: "DEBIT",
                    amount: fare,
                    description: "Parking Fare",
                    referenceId: session._id.toString()
                });

                session.paymentStatus = "PAID";

                await wallet.save();
            } else {
                session.paymentStatus = "UNPAID";
            }
        } else {
            session.paymentStatus = "UNPAID";
        }

        await session.save();

        // 3️⃣ Release slot
        const slot = await ParkingSlot.findOne({
            lotId,
            slotNumber: session.slotNumber
        });

        if (slot) {
            slot.status = "AVAILABLE";
            slot.currentSession = null;
            await slot.save();
        }

        return {
            success: true,
            message: "Exit allowed",
            action: "OPEN_EXIT_GATE",
            data: {
                slotNumber: session.slotNumber,
                durationMinutes: session.durationMinutes,
                fare: session.fare,
                paymentStatus: session.paymentStatus
            }
        };
    }

}

module.exports = ParkingService;
