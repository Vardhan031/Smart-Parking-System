const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");

class AdminController {
    // 1️⃣ Create Parking Lot
    static async createLot(req, res) {
        try {
            const { name, code, totalSlots, pricing } = req.body;

            if (!name || !code || !totalSlots || !pricing?.ratePerHour) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields"
                });
            }

            const lot = await ParkingLot.create({
                name,
                code,
                totalSlots,
                pricing
            });

            return res.status(201).json({
                success: true,
                data: lot
            });
        } catch (error) {
            console.error("CREATE LOT ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to create parking lot"
            });
        }
    }

    // 2️⃣ Create Parking Slots (bulk)
    static async createSlots(req, res) {
        try {
            const { lotId, count, vehicleType = "CAR" } = req.body;

            if (!lotId || !count) {
                return res.status(400).json({
                    success: false,
                    message: "lotId and count are required"
                });
            }

            const lot = await ParkingLot.findById(lotId);
            if (!lot) {
                return res.status(404).json({
                    success: false,
                    message: "Parking lot not found"
                });
            }

            const existingCount = await ParkingSlot.countDocuments({ lotId });

            const slots = [];
            for (let i = 1; i <= count; i++) {
                slots.push({
                    lotId,
                    slotNumber: existingCount + i,
                    vehicleType
                });
            }

            await ParkingSlot.insertMany(slots);

            return res.json({
                success: true,
                message: `${count} slots created`
            });
        } catch (error) {
            console.error("CREATE SLOTS ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to create slots"
            });
        }
    }

    // 3️⃣ Enable / Disable Parking Lot
    static async toggleLot(req, res) {
        try {
            const { lotId, active } = req.body;

            const lot = await ParkingLot.findByIdAndUpdate(
                lotId,
                { active },
                { new: true }
            );

            if (!lot) {
                return res.status(404).json({
                    success: false,
                    message: "Parking lot not found"
                });
            }

            return res.json({
                success: true,
                data: lot
            });
        } catch (error) {
            console.error("TOGGLE LOT ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to update lot"
            });
        }
    }

    // 4️⃣ List Parking Lots
    static async listLots(req, res) {
        try {
            const lots = await ParkingLot.find().sort({ createdAt: -1 });

            const enrichedLots = await Promise.all(
                lots.map(async (lot) => {
                    const occupiedCount = await require("../models/ParkingSlot")
                        .countDocuments({
                            lotId: lot._id,
                            status: "OCCUPIED"
                        });

                    const availableCount = lot.totalSlots - occupiedCount;

                    const occupancyPercentage =
                        lot.totalSlots === 0
                            ? 0
                            : Math.round((occupiedCount / lot.totalSlots) * 100);

                    return {
                        ...lot.toObject(),
                        occupiedCount,
                        availableCount,
                        occupancyPercentage
                    };
                })
            );

            res.json({
                success: true,
                data: enrichedLots
            });
        } catch (error) {
            console.error("LIST LOTS ERROR:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch lots"
            });
        }
    }


    // 5️⃣ List Slots for a Lot
    static async listSlots(req, res) {
        const { lotId } = req.params;

        const slots = await ParkingSlot.find({ lotId }).sort({ slotNumber: 1 });
        res.json({ success: true, data: slots });
    }

    static async getActiveSessionBySlot(req, res) {
        try {
            const { lotId, slotNumber } = req.params

            const session = await require("../models/ParkingSession").findOne({
                lotId,
                slotNumber: Number(slotNumber),
                status: "IN"
            })

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "No active session found"
                })
            }

            return res.json({
                success: true,
                data: session
            })
        } catch (error) {
            console.error("GET ACTIVE SESSION ERROR:", error)
            return res.status(500).json({
                success: false,
                message: "Failed to fetch session"
            })
        }
    }

}

module.exports = AdminController;
