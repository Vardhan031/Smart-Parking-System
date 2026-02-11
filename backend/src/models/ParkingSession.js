const mongoose = require("mongoose");

const parkingSessionSchema = new mongoose.Schema(
    {
        plateNumber: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true
        },

        lotId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ParkingLot",
            required: true,
            index: true
        },

        slotNumber: {
            type: Number,
            required: true
        },

        entryTime: {
            type: Date,
            required: true
        },

        exitTime: {
            type: Date,
            default: null
        },

        durationMinutes: {
            type: Number,
            default: null
        },

        amount: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            enum: ["IN", "EXIT_PENDING", "PAID", "OUT"],
            default: "IN",
            index: true
        },

        paymentStatus: {
            type: String,
            enum: ["PENDING", "PAID"],
            default: "PENDING"
        }
    },
    { timestamps: true }
);

// 🔒 Prevent duplicate active parking for same vehicle
parkingSessionSchema.index(
    { plateNumber: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "IN" }
    }
);

module.exports = mongoose.model("ParkingSession", parkingSessionSchema);
