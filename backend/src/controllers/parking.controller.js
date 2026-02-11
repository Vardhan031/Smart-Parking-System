const ParkingService = require("../services/parking.service.js");

class ParkingController {
    static async entry(req, res) {
        try {
            const { plateNumber, lotId, vehicleType } = req.body;

            if (!plateNumber || !lotId) {
                return res.status(400).json({
                    success: false,
                    message: "plateNumber and lotId are required"
                });
            }

            const result = await ParkingService.handleEntry({
                plateNumber,
                lotId,
                vehicleType
            });

            return res.status(result.success ? 200 : 403).json(result);
        } catch (error) {
            console.error("ENTRY ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    static async exit(req, res) {
        try {
            const { plateNumber, lotId } = req.body;

            if (!plateNumber || !lotId) {
                return res.status(400).json({
                    success: false,
                    message: "plateNumber and lotId are required"
                });
            }

            const result = await ParkingService.handleExit({
                plateNumber,
                lotId
            });

            return res.status(result.success ? 200 : 403).json(result);
        } catch (error) {
            console.error("EXIT ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

}

module.exports = ParkingController;
