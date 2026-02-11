require("dotenv").config();
const mongoose = require("mongoose");

const ParkingLot = require("../models/ParkingLot");
const ParkingSlot = require("../models/ParkingSlot");

const connectDB = async () => {
    await mongoose.connect(process.env.MONGO_URI);
};

const seed = async () => {
    try {
        await connectDB();

        console.log("Connected to DB");

        // 1️⃣ Create Parking Lot
        const lot = await ParkingLot.create({
            name: "Main Parking",
            code: "LOT-A",
            totalSlots: 10,
            active: true,
            pricing: {
                ratePerHour: 20,
                freeMinutes: 10
            }
        });

        console.log("Parking Lot created:", lot._id.toString());

        // 2️⃣ Create Parking Slots
        const slots = [];

        for (let i = 1; i <= 10; i++) {
            slots.push({
                lotId: lot._id,
                slotNumber: i,
                status: "AVAILABLE",
                vehicleType: "CAR"
            });
        }

        await ParkingSlot.insertMany(slots);

        console.log("Parking Slots created");

        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seed();
