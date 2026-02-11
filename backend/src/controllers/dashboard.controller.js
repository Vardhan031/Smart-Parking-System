const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");
const ParkingSession = require("../models/ParkingSession");

class DashboardController {
    static async getOverview(req, res) {
        try {
            const totalLots = await ParkingLot.countDocuments();

            const totalSlots = await ParkingSlot.countDocuments();

            const totalOccupied = await ParkingSlot.countDocuments({
                status: "OCCUPIED",
            });

            const activeSessions = await ParkingSession.countDocuments({
                status: "IN",
            });

            const utilizationPercentage =
                totalSlots === 0
                    ? 0
                    : Math.round((totalOccupied / totalSlots) * 100);

            // Start of today
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const todayEntries = await ParkingSession.countDocuments({
                entryTime: { $gte: startOfToday },
            });

            const todayExits = await ParkingSession.countDocuments({
                exitTime: { $gte: startOfToday },
            });

            res.json({
                success: true,
                data: {
                    totalLots,
                    totalSlots,
                    totalOccupied,
                    activeSessions,
                    utilizationPercentage,
                    todayEntries,
                    todayExits,
                },
            });
        } catch (error) {
            console.error("DASHBOARD OVERVIEW ERROR:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch dashboard data",
            });
        }
    }
}

module.exports = DashboardController;
