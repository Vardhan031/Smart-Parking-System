const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");

class UserLotController {
    /**
     * GET /lots — Active lots with real-time availability count.
     * Optional query params: lat, lng (sort by proximity).
     */
    static async listLots(req, res) {
        try {
            const lots = await ParkingLot.find({ active: true }).lean();

            // Aggregate available slot counts per lot in one query
            const availability = await ParkingSlot.aggregate([
                {
                    $match: {
                        lotId: { $in: lots.map((l) => l._id) },
                        status: "AVAILABLE"
                    }
                },
                { $group: { _id: "$lotId", available: { $sum: 1 } } }
            ]);

            const availMap = {};
            for (const a of availability) {
                availMap[a._id.toString()] = a.available;
            }

            let result = lots.map((lot) => ({
                ...lot,
                availableSlots: availMap[lot._id.toString()] || 0
            }));

            // Sort by proximity if lat/lng provided
            const { lat, lng } = req.query;
            if (lat && lng) {
                const userLat = parseFloat(lat);
                const userLng = parseFloat(lng);
                if (!isNaN(userLat) && !isNaN(userLng)) {
                    result = result
                        .map((lot) => {
                            const lotLat = lot.location?.latitude;
                            const lotLng = lot.location?.longitude;
                            if (lotLat != null && lotLng != null) {
                                lot.distance = haversine(userLat, userLng, lotLat, lotLng);
                            } else {
                                lot.distance = Infinity;
                            }
                            return lot;
                        })
                        .sort((a, b) => a.distance - b.distance);
                }
            }

            return res.json({ success: true, data: result });
        } catch (err) {
            console.error("LIST LOTS ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * GET /lots/:id — Single lot with slot counts by vehicleType and status.
     */
    static async getLotDetail(req, res) {
        try {
            const lot = await ParkingLot.findById(req.params.id).lean();

            if (!lot || !lot.active) {
                return res.status(404).json({
                    success: false,
                    message: "Lot not found"
                });
            }

            const slotCounts = await ParkingSlot.aggregate([
                { $match: { lotId: lot._id } },
                {
                    $group: {
                        _id: { vehicleType: "$vehicleType", status: "$status" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Transform raw aggregation into per-vehicleType breakdown
            const slotMap = {};
            for (const entry of slotCounts) {
                const { vehicleType, status } = entry._id;
                if (!slotMap[vehicleType]) {
                    slotMap[vehicleType] = { vehicleType, available: 0, occupied: 0, maintenance: 0, total: 0 };
                }
                const key = status.toLowerCase(); // AVAILABLE → available
                if (key in slotMap[vehicleType]) {
                    slotMap[vehicleType][key] = entry.count;
                }
                slotMap[vehicleType].total += entry.count;
            }
            const slots = Object.values(slotMap);

            return res.json({
                success: true,
                data: { ...lot, slots }
            });
        } catch (err) {
            console.error("LOT DETAIL ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }
}

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversine(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = UserLotController;
