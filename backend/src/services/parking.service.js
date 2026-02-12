const ParkingSession = require("../models/ParkingSession");
const ParkingSlot = require("../models/ParkingSlot");

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

        // 3️⃣ Create session
        const session = await ParkingSession.create({
            plateNumber,
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

        // 2️⃣ Update session (duration auto-calculated in model)
        session.exitTime = new Date();
        session.status = "OUT";
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
                durationMinutes: session.durationMinutes
            }
        };
    }
}

module.exports = ParkingService;
