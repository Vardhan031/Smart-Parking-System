const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        phone: {
            type: String,
            unique: true,
            sparse: true,
            trim: true
        },

        passwordHash: {
            type: String,
            required: true
        },

        vehiclePlates: {
            type: [
                {
                    type: String,
                    uppercase: true,
                    trim: true
                }
            ],
            default: []
        },

        walletBalance: {
            type: Number,
            default: 0
        },

        fcmToken: {
            type: String,
            default: null
        },

        active: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
