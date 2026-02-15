const User = require("../models/User");
const ParkingSession = require("../models/ParkingSession");

// Basic Indian / generic plate format: alphanumeric, 4-15 chars
const PLATE_REGEX = /^[A-Z0-9]{4,15}$/;

class UserVehicleController {
    /**
     * POST /vehicles — Link a plate to user's account.
     * Body: { plateNumber }
     */
    static async linkVehicle(req, res) {
        try {
            let { plateNumber } = req.body;

            if (!plateNumber || typeof plateNumber !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "plateNumber is required"
                });
            }

            plateNumber = plateNumber.replace(/[\s-]/g, "").toUpperCase();

            if (!PLATE_REGEX.test(plateNumber)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid plate number format"
                });
            }

            // Check if plate is already linked to another user
            const existing = await User.findOne({
                vehiclePlates: plateNumber,
                _id: { $ne: req.user.id }
            });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: "This plate is already linked to another account"
                });
            }

            const user = await User.findByIdAndUpdate(
                req.user.id,
                { $addToSet: { vehiclePlates: plateNumber } },
                { new: true }
            );

            return res.json({
                success: true,
                data: { vehiclePlates: user.vehiclePlates }
            });
        } catch (err) {
            console.error("LINK VEHICLE ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * DELETE /vehicles/:plate — Unlink a plate from user's account.
     * Rejects if vehicle has an active session.
     */
    static async unlinkVehicle(req, res) {
        try {
            const plateNumber = req.params.plate.replace(/[\s-]/g, "").toUpperCase();

            // Reject if vehicle is currently parked
            const activeSession = await ParkingSession.findOne({
                plateNumber,
                status: "IN"
            });

            if (activeSession) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot unlink — vehicle has an active parking session"
                });
            }

            const user = await User.findByIdAndUpdate(
                req.user.id,
                { $pull: { vehiclePlates: plateNumber } },
                { new: true }
            );

            return res.json({
                success: true,
                data: { vehiclePlates: user.vehiclePlates }
            });
        } catch (err) {
            console.error("UNLINK VEHICLE ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }
}

module.exports = UserVehicleController;
