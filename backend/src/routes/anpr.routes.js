const express = require("express");
const multer = require("multer");
const ANPRController = require("../controllers/anpr.controller");

const router = express.Router();

// Configure multer for memory storage (buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"), false);
        }
    }
});

// Standalone plate detection
router.post("/detect", upload.single("image"), ANPRController.detect);

// Image-based entry (detect plate + entry flow)
router.post("/entry", upload.single("image"), ANPRController.imageEntry);

// Image-based exit (detect plate + exit flow)
router.post("/exit", upload.single("image"), ANPRController.imageExit);

module.exports = router;
