const express = require("express");
const router = express.Router();
const SessionController = require("../controllers/session.controller");
const adminAuth = require("../middleware/auth.middleware");

// GET all sessions (admin only)
router.get("/", adminAuth, SessionController.getSessions);

module.exports = router;
