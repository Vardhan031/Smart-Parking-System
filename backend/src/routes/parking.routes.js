const express = require("express");
const ParkingController = require("../controllers/parking.controller");

const router = express.Router();

// ENTRY
router.post("/entry", ParkingController.entry);


// EXIT
router.post("/exit", ParkingController.exit);


module.exports = router;
