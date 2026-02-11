require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db.js")
const parkingRoutes = require("./src/routes/parking.routes.js");
const authRoutes = require("./src/routes/auth.routes.js");
const dashboardRoutes = require("./src/routes/dashboard.routes.js");
const adminRoutes = require("./src/routes/admin.routes.js");

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




const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
