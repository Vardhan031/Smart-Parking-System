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

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
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
            default: null,
        },

        paymentStatus: {
            type: String,
            enum: ["PAID", "UNPAID", "NO_USER"],
            default: null,
        },

        status: {
            type: String,
            enum: ["IN", "OUT"],
            default: "IN",
            index: true,
        },
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

// 🔥 Auto-calculate duration and fare on exit
parkingSessionSchema.pre("save", async function () {
    if (this.status === "OUT" && this.exitTime && this.entryTime) {
        const diff = this.exitTime - this.entryTime;
        this.durationMinutes = Math.ceil(diff / (1000 * 60));

        // Calculate fare from lot pricing if not already set
        if (this.fare == null) {
            try {
                const ParkingLot = mongoose.model("ParkingLot");
                const lot = await ParkingLot.findById(this.lotId);
                if (lot && lot.pricing) {
                    const { ratePerHour, freeMinutes = 0 } = lot.pricing;
                    const billableMinutes = Math.max(0, this.durationMinutes - freeMinutes);
                    this.fare = Math.ceil((billableMinutes / 60) * ratePerHour);
                }
            } catch (err) {
                console.error("FARE CALCULATION ERROR:", err.message);
            }
        }
    }
});

module.exports = mongoose.model("ParkingSession", parkingSessionSchema);
