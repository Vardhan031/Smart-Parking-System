const mongoose = require("mongoose");

const parkingSessionSchema = new mongoose.Schema(
    {
        plateNumber: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true,
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        lotId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ParkingLot",
            required: true,
            index: true,
        },

        slotNumber: {
            type: Number,
            required: true,
        },

        entryTime: {
            type: Date,
            required: true,
            default: Date.now,
        },

        exitTime: {
            type: Date,
            default: null,
        },

        durationMinutes: {
            type: Number,
            default: null,
        },

        fare: {
            type: Number,
            default: 0
        },

        paymentStatus: {
            type: String,
            enum: ["PENDING", "PAID", "UNPAID"],
            default: "PENDING"
        },

        status: {
            type: String,
            enum: ["IN", "OUT"],
            default: "IN",
            index: true,
        }
    },
    { timestamps: true }
);

// 🔒 Prevent duplicate active parking for same vehicle
parkingSessionSchema.index(
    { plateNumber: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "IN" },
    }
);

// 🔥 Auto-calculate duration on exit
parkingSessionSchema.pre("save", function () {
    if (this.status === "OUT" && this.exitTime && this.entryTime) {
        const diff = this.exitTime - this.entryTime;
        this.durationMinutes = Math.ceil(diff / (1000 * 60));
    }

});

module.exports = mongoose.model("ParkingSession", parkingSessionSchema);
