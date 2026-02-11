const express = require("express");
const adminAuth = require("../middleware/auth.middleware");
const DashboardController = require("../controllers/dashboard.controller");

const router = express.Router();

router.get(
    "/overview",
    adminAuth,
    DashboardController.getOverview
);

module.exports = router;
