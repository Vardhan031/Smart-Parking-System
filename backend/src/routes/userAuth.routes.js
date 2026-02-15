const express = require("express");
const router = express.Router();

const userAuthController = require("../controllers/userAuth.controller");
const userAuth = require("../middleware/userAuth.middleware.js");

router.post("/register", userAuthController.register);
router.post("/login", userAuthController.login);


router.post("/vehicles", userAuth, userAuthController.addVehicle);
router.delete("/vehicles/:plate", userAuth, userAuthController.removeVehicle);

router.get("/wallet", userAuth, userAuthController.getWallet);
router.post("/wallet/topup", userAuth, userAuthController.topUpWallet);


router.get("/sessions/active", userAuth, userAuthController.getActiveSession);
router.get("/sessions/history", userAuth, userAuthController.getSessionHistory);

router.get("/lots", userAuth, userAuthController.getLots);
router.get("/lots/:id", userAuth, userAuthController.getLotById);

router.get("/lots/:id/slots", userAuth, userAuthController.getLotSlots);







module.exports = router;
