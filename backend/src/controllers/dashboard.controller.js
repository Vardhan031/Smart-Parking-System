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

            // Start of today and yesterday
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const startOfYesterday = new Date(startOfToday);
            startOfYesterday.setDate(startOfYesterday.getDate() - 1);

            const todayEntries = await ParkingSession.countDocuments({
                entryTime: { $gte: startOfToday },
            });

            const todayExits = await ParkingSession.countDocuments({
                exitTime: { $gte: startOfToday },
            });

            // --- Recent Activity: last 10 entries/exits ---
            const recentActivity = await ParkingSession.find({})
                .sort({ updatedAt: -1 })
                .limit(10)
                .populate("lotId", "name")
                .lean();

            const formattedActivity = recentActivity.map((s) => ({
                plate: s.plateNumber,
                lot: s.lotId?.name || "Unknown",
                type: s.status === "IN" ? "Entry" : "Exit",
                time: s.status === "IN" ? s.entryTime : s.exitTime,
            }));

            // --- Per-Lot Breakdown ---
            const lots = await ParkingLot.find({ active: true }).lean();
            const lotBreakdown = await Promise.all(
                lots.map(async (lot) => {
                    const total = await ParkingSlot.countDocuments({ lotId: lot._id });
                    const occupied = await ParkingSlot.countDocuments({
                        lotId: lot._id,
                        status: "OCCUPIED",
                    });
                    return {
                        name: lot.name,
                        used: occupied,
                        total,
                    };
                })
            );

            // --- Today's Revenue ---
            const revenueAgg = await ParkingSession.aggregate([
                {
                    $match: {
                        exitTime: { $gte: startOfToday },
                        fare: { $ne: null },
                    },
                },
                { $group: { _id: null, total: { $sum: "$fare" } } },
            ]);
            const todayRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

            // --- Average Park Time (today's exits) ---
            const avgAgg = await ParkingSession.aggregate([
                {
                    $match: {
                        exitTime: { $gte: startOfToday },
                        durationMinutes: { $ne: null },
                    },
                },
                { $group: { _id: null, avg: { $avg: "$durationMinutes" } } },
            ]);
            const avgParkTime =
                avgAgg.length > 0 ? Math.round(avgAgg[0].avg * 10) / 10 : 0;

            // --- Yesterday Comparison ---
            const yesterdayEntries = await ParkingSession.countDocuments({
                entryTime: { $gte: startOfYesterday, $lt: startOfToday },
            });
            const vsYesterday =
                yesterdayEntries === 0
                    ? todayEntries > 0
                        ? 100
                        : 0
                    : Math.round(
                          ((todayEntries - yesterdayEntries) / yesterdayEntries) * 100
                      );

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
                    recentActivity: formattedActivity,
                    lotBreakdown,
                    todayRevenue,
                    avgParkTime,
                    vsYesterday,
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
