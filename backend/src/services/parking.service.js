const ParkingSession = require("../models/ParkingSession");
const ParkingSlot = require("../models/ParkingSlot");

class ParkingService {
    /**
     * ENTRY FLOW
     * Handles vehicle entry into parking
     */
    static async handleEntry({ plateNumber, lotId, vehicleType = "CAR" }) {
        // Normalize plate number
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

        // 3️⃣ Create parking session
        const session = await ParkingSession.create({
            plateNumber,
            lotId,
            slotNumber: availableSlot.slotNumber,
            entryTime: new Date(),
            status: "IN",
            paymentStatus: "PENDING"
        });

        // 4️⃣ Occupy slot
        availableSlot.status = "OCCUPIED";
        availableSlot.currentSession = session._id;
        await availableSlot.save();

        // 5️⃣ Allow entry
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

    static async handleExit({ plateNumber, lotId }) {
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

        // 2️⃣ Calculate duration
        const exitTime = new Date();
        const durationMs = exitTime - session.entryTime;
        const durationMinutes = Math.ceil(durationMs / (1000 * 60));

        // 3️⃣ Update session
        session.exitTime = exitTime;
        session.durationMinutes = durationMinutes;
        session.status = "OUT";
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

        // 5️⃣ Allow exit
        return {
            success: true,
            message: "Exit allowed",
            action: "OPEN_EXIT_GATE",
            data: {
                slotNumber: session.slotNumber,
                durationMinutes
            }
        };
    }

}

module.exports = ParkingService;
