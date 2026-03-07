const ParkingSession = require("../models/ParkingSession");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingLot = require("../models/ParkingLot");
const User = require("../models/User");
const WalletService = require("./wallet.service");
const NotificationService = require("./notification.service");

class ParkingService {

    /**
     * 🚗 ENTRY FLOW
     * @param {string} plateNumber  - Vehicle plate (will be normalised to uppercase)
     * @param {string} lotId        - Parking lot ObjectId
     * @param {string} vehicleType  - "CAR" | "BIKE" (default: "CAR")
     * @param {Date|null} entryTime - Timestamp from CCTV overlay; falls back to now()
     */
    static async handleEntry({ plateNumber, lotId, vehicleType = "CAR", entryTime = null }) {
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

        // 3️⃣ Create session — use camera timestamp when available for accurate fare calculation
        const session = await ParkingSession.create({
            plateNumber,
            lotId,
            slotNumber: availableSlot.slotNumber,
            entryTime: (entryTime instanceof Date && !isNaN(entryTime)) ? entryTime : new Date(),
            status: "IN"
        });

        // 4️⃣ Link session to registered user (if plate is registered)
        const user = await User.findOne({ vehiclePlates: plateNumber });
        if (user) {
            session.userId = user._id;
            await session.save();
        }

        // 5️⃣ Occupy slot
        availableSlot.status = "OCCUPIED";
        availableSlot.currentSession = session._id;
        await availableSlot.save();

        // 6️⃣ Push notification (fire-and-forget)
        if (user) {
            const lot = await ParkingLot.findById(lotId).select("name").lean();
            const lotName = lot ? lot.name : "Unknown Lot";
            NotificationService.sendToUser(user._id, {
                title: "Car Parked",
                body: `Your car ${plateNumber} parked at ${lotName}, Slot ${availableSlot.slotNumber}`,
                data: { sessionId: String(session._id), lotId: String(lotId) }
            }).catch((err) => console.error("PUSH ENTRY ERROR:", err.message));
        }

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
     * @param {string} plateNumber - Vehicle plate
     * @param {string} lotId       - Parking lot ObjectId
     * @param {Date|null} exitTime - Timestamp from CCTV overlay; falls back to now()
     */
    static async handleExit({ plateNumber, lotId, exitTime = null }) {
        plateNumber = plateNumber.trim().toUpperCase();

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

        // 2️⃣ Update session — use camera timestamp so fare reflects actual duration
        session.exitTime = (exitTime instanceof Date && !isNaN(exitTime)) ? exitTime : new Date();
        session.status = "OUT";
        await session.save();

        // 3️⃣ Attempt wallet deduction if user is linked
        if (session.userId && session.fare > 0) {
            const result = await WalletService.deductFare(
                session.userId,
                session.fare,
                session._id
            );
            session.paymentStatus = result.success ? "PAID" : "UNPAID";
        } else if (!session.userId) {
            session.paymentStatus = "NO_USER";
        } else {
            session.paymentStatus = "PAID"; // fare is 0 (within free minutes)
        }
        await session.save();

        // 4️⃣ Release slot
        const slot = await ParkingSlot.findOne({
            lotId,
            slotNumber: session.slotNumber
        });

        if (slot) {
            slot.status = "AVAILABLE";
            slot.currentSession = null;
            await slot.save();
        }

        // 5️⃣ Push notification with fare summary (fire-and-forget)
        if (session.userId) {
            const lot = await ParkingLot.findById(lotId).select("name").lean();
            const lotName = lot ? lot.name : "Unknown Lot";
            const hrs = Math.floor(session.durationMinutes / 60);
            const mins = session.durationMinutes % 60;
            const duration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            NotificationService.sendToUser(session.userId, {
                title: "Car Exited",
                body: `Your car ${plateNumber} exited ${lotName}. Duration: ${duration}. Fare: ₹${session.fare}`,
                data: {
                    sessionId: String(session._id),
                    fare: String(session.fare),
                    paymentStatus: session.paymentStatus
                }
            }).catch((err) => console.error("PUSH EXIT ERROR:", err.message));
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
