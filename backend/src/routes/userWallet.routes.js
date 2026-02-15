const express = require("express");
const userAuth = require("../middleware/userAuth.middleware");
const UserWalletController = require("../controllers/userWallet.controller");

const router = express.Router();

// All wallet routes require user authentication
router.use(userAuth);

router.get("/", UserWalletController.getWallet);
router.post("/topup", UserWalletController.topUp);
router.post("/verify-payment", UserWalletController.verifyPayment);

module.exports = router;
