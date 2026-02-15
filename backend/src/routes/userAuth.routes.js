const express = require("express");
const UserAuthController = require("../controllers/userAuth.controller");

const router = express.Router();

router.post("/register", UserAuthController.register);
router.post("/login", UserAuthController.login);

module.exports = router;
