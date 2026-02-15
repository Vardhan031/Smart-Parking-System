const express = require("express");

const parkingRoutes = require("../src/routes/parking.routes");
const authRoutes = require("../src/routes/auth.routes");
const dashboardRoutes = require("../src/routes/dashboard.routes");
const adminRoutes = require("../src/routes/admin.routes");
const sessionRoutes = require("../src/routes/sessions.routes");
const userAuthRoutes = require("../src/routes/userAuth.routes");
const userWalletRoutes = require("../src/routes/userWallet.routes");
const userAppRoutes = require("../src/routes/userApp.routes");

function createApp() {
    const app = express();
    app.use(express.json());

    app.get("/", (req, res) => {
        res.json({ status: "Smart Parking Backend Running" });
    });

    app.use("/api/parking", parkingRoutes);
    app.use("/api/auth", authRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/sessions", sessionRoutes);
    app.use("/api/user/auth", userAuthRoutes);
    app.use("/api/user/wallet", userWalletRoutes);
    app.use("/api/user", userAppRoutes);

    return app;
}

module.exports = createApp;
