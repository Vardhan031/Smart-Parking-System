const mongoose = require("mongoose");

const parkingSlotSchema = new mongoose.Schema(
    {
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

        status: {
            type: String,
            enum: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"],
            default: "AVAILABLE",
            index: true,
        },

        vehicleType: {
            type: String,
            enum: ["CAR", "BIKE"],
            default: "CAR",
            index: true,
        },

        currentSession: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ParkingSession",
            default: null,
        },
    },
    { timestamps: true }
);

/**
 * 🔒 Unique slot per lot
 */
parkingSlotSchema.index(
    { lotId: 1, slotNumber: 1 },
    { unique: true }
);

/**
 * ⚡ Fast query index for availability
 */
parkingSlotSchema.index(
    { lotId: 1, status: 1, vehicleType: 1 }
);

/**
 * 🚗 Find first available slot
 */
parkingSlotSchema.statics.findAvailableSlot = function (
    lotId,
    vehicleType = "CAR"
) {
    return this.findOne({
        lotId,
        status: "AVAILABLE",
        vehicleType,
    }).sort({ slotNumber: 1 });
};

/**
 * 🔐 Mark slot as occupied
 */
parkingSlotSchema.methods.occupy = async function (sessionId) {
    this.status = "OCCUPIED";
    this.currentSession = sessionId;
    return this.save();
};

/**
 * 🔓 Release slot
 */
parkingSlotSchema.methods.release = async function () {
    this.status = "AVAILABLE";
    this.currentSession = null;
    return this.save();
};

module.exports = mongoose.model("ParkingSlot", parkingSlotSchema);
