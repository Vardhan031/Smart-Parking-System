const ParkingSession = require("../models/ParkingSession");

class SessionController {
    static async getSessions(req, res) {
        try {
            const { status, plateNumber, lotId, limit = 20, offset = 0 } = req.query;

            const filter = {};

            if (status) {
                filter.status = status;
            }

            if (plateNumber) {
                filter.plateNumber = plateNumber.trim().toUpperCase();
            }

            if (lotId) {
                filter.lotId = lotId;
            }

            const totalCount = await ParkingSession.countDocuments(filter);

            const sessions = await ParkingSession.find(filter)
                .populate("lotId", "name location")
                .sort({ entryTime: -1 })
                .skip(Number(offset))
                .limit(Number(limit));

            return res.status(200).json({
                success: true,
                totalCount,
                count: sessions.length,
                data: sessions,
            });
        } catch (error) {
            console.error("GET SESSIONS ERROR:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch sessions",
            });
        }
    }
}

module.exports = SessionController;
