const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["CREDIT", "DEBIT"],
            required: true
        },

        amount: {
            type: Number,
            required: true
        },

        description: {
            type: String,
            default: ""
        },

        reference: {
            type: String,
            default: null
        },

        createdAt: {
            type: Date,
            default: Date.now
        }
    },
    { _id: true }
);

const walletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        balance: {
            type: Number,
            default: 0
        },

        transactions: {
            type: [transactionSchema],
            default: []
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Wallet", walletSchema);
