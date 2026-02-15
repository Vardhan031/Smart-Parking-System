const ParkingSession = require("../models/ParkingSession");
const User = require("../models/User");

class UserSessionController {
    /**
     * GET /sessions/active — Find active session for any of user's plates.
     */
    static async getActiveSession(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user || user.vehiclePlates.length === 0) {
                return res.json({ success: true, data: null });
            }

            const session = await ParkingSession.findOne({
                plateNumber: { $in: user.vehiclePlates },
                status: "IN"
            }).populate("lotId", "name code location pricing");

            return res.json({ success: true, data: session });
        } catch (err) {
            console.error("ACTIVE SESSION ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * GET /sessions/history — Paginated past sessions for user's plates.
     * Query params: page (default 1), limit (default 20)
     */
    static async getSessionHistory(req, res) {
        try {
            const user = await User.findById(req.user.id);
            if (!user || user.vehiclePlates.length === 0) {
                return res.json({
                    success: true,
                    data: [],
                    pagination: { page: 1, limit: 20, total: 0 }
                });
            }

            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
            const skip = (page - 1) * limit;

            const filter = {
                plateNumber: { $in: user.vehiclePlates },
                status: "OUT"
            };

            const [sessions, total] = await Promise.all([
                ParkingSession.find(filter)
                    .sort({ exitTime: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate("lotId", "name code location pricing")
                    .lean(),
                ParkingSession.countDocuments(filter)
            ]);

            return res.json({
                success: true,
                data: sessions,
                pagination: { page, limit, total }
            });
        } catch (err) {
            console.error("SESSION HISTORY ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }
}

module.exports = UserSessionController;
