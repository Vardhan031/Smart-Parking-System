const express = require("express");
const userAuth = require("../middleware/userAuth.middleware");
const UserLotController = require("../controllers/userLot.controller");
const UserSessionController = require("../controllers/userSession.controller");
const UserVehicleController = require("../controllers/userVehicle.controller");
const User = require("../models/User");

const router = express.Router();

// Public (no auth required)
router.get("/lots", UserLotController.listLots);
router.get("/lots/:id", UserLotController.getLotDetail);

// Protected (userAuth required)
router.get("/sessions/active", userAuth, UserSessionController.getActiveSession);
router.get("/sessions/history", userAuth, UserSessionController.getSessionHistory);
router.post("/vehicles", userAuth, UserVehicleController.linkVehicle);
router.delete("/vehicles/:plate", userAuth, UserVehicleController.unlinkVehicle);

// User profile
router.get("/profile", userAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select(
            "name email phone vehiclePlates"
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone || null,
                vehiclePlates: user.vehiclePlates,
            },
        });
    } catch (err) {
        console.error("USER PROFILE ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

// FCM token registration
router.post("/fcm-token", userAuth, async (req, res) => {
    try {
        const { fcmToken } = req.body;

        if (!fcmToken || typeof fcmToken !== "string") {
            return res.status(400).json({
                success: false,
                message: "A valid fcmToken string is required"
            });
        }

        await User.findByIdAndUpdate(req.user.id, { fcmToken });

        return res.json({ success: true, message: "FCM token saved" });
    } catch (err) {
        console.error("FCM TOKEN ERROR:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

module.exports = router;
