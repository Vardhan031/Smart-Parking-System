const express = require("express");
const AdminController = require("../controllers/admin.controller");
const adminAuth = require("../middleware/auth.middleware");

const router = express.Router();

// Parking Lot management
router.post("/lot", adminAuth, AdminController.createLot);
router.patch("/lot", adminAuth, AdminController.toggleLot);
router.get("/lots", adminAuth, AdminController.listLots);

// Parking Slot management
router.post("/slots", adminAuth, AdminController.createSlots);
router.get("/slots/:lotId", adminAuth, AdminController.listSlots);

router.get(
    "/session/active/:lotId/:slotNumber",
    adminAuth,
    AdminController.getActiveSessionBySlot
)


module.exports = router;
