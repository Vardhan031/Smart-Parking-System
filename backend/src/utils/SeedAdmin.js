require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const AdminUser = require("../models/AdminUser");

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const username = "admin";
        const password = "admin123"; // change later

        const existing = await AdminUser.findOne({ username });
        if (existing) {
            console.log("Admin already exists");
            process.exit(0);
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await AdminUser.create({
            username,
            passwordHash
        });

        console.log("Admin created");
        console.log("USERNAME:", username);
        console.log("PASSWORD:", password);

        process.exit(0);
    } catch (err) {
        console.error("Admin seed failed:", err);
        process.exit(1);
    }
};

seedAdmin();
