require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db.js")
const parkingRoutes = require("./src/routes/parking.routes.js");
const authRoutes = require("./src/routes/auth.routes.js");
const dashboardRoutes = require("./src/routes/dashboard.routes.js");
const adminRoutes = require("./src/routes/admin.routes.js");
const sessionRoutes = require("./src/routes/sessions.routes.js");
const userAuthRoutes = require("./src/routes/userAuth.routes.js");
const userWalletRoutes = require("./src/routes/userWallet.routes.js");
const userAppRoutes = require("./src/routes/userApp.routes.js");
const anprRoutes = require("./src/routes/anpr.routes.js");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

connectDB();

// Health check route
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

app.use("/api/anpr", anprRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
