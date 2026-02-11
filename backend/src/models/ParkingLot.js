const mongoose = require("mongoose");

const parkingLotSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true
        },

        location: {
            address: {
                type: String,
                default: ""
            },
            latitude: Number,
            longitude: Number
        },

        totalSlots: {
            type: Number,
            required: true,
            min: 1
        },

        active: {
            type: Boolean,
            default: true
        },

        pricing: {
            ratePerHour: {
                type: Number,
                required: true
            },
            freeMinutes: {
                type: Number,
                default: 0
            }
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("ParkingLot", parkingLotSchema);
