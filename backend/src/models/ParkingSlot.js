const mongoose = require("mongoose");

const parkingSlotSchema = new mongoose.Schema(
    {
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

        status: {
            type: String,
            enum: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"],
            default: "AVAILABLE",
            index: true
        },

        vehicleType: {
            type: String,
            enum: ["CAR", "BIKE"],
            default: "CAR"
        },

        currentSession: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ParkingSession",
            default: null
        }
    },
    { timestamps: true }
);

// Ensure slot number is unique within a lot
parkingSlotSchema.index(
    { lotId: 1, slotNumber: 1 },
    { unique: true }
);

// Find first available slot in a lot
parkingSlotSchema.statics.findAvailableSlot = function (
    lotId,
    vehicleType = "CAR"
) {
    return this.findOne({
        lotId,
        status: "AVAILABLE",
        vehicleType
    }).sort({ slotNumber: 1 });
};

module.exports = mongoose.model("ParkingSlot", parkingSlotSchema);
