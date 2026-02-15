const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true
    },
    phone: {
        type: String,
        unique: true,
        required: true
    },
    passwordHash: {
        type: String
    },
    vehiclePlates: [{
        type: String,
        trim: true,
        uppercase: true
    }],
    walletBalance: {
        type: Number,
        default: 0
    },
    active: {
        type: Boolean,
        default: true
    },
    role: {
        type: String,
        default: "USER"
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
