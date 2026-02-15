const Wallet = require("../models/Wallet");
const NotificationService = require("./notification.service");

const LOW_BALANCE_THRESHOLD = 50;

class WalletService {
    /**
     * 💸 Atomic fare deduction
     * Uses findOneAndUpdate with balance >= amount condition to prevent overdraft.
     * Returns { success, wallet } on success, { success: false } on insufficient balance.
     */
    static async deductFare(userId, amount, sessionId) {
        const wallet = await Wallet.findOneAndUpdate(
            { userId, balance: { $gte: amount } },
            {
                $inc: { balance: -amount },
                $push: {
                    transactions: {
                        type: "DEBIT",
                        amount,
                        description: "Parking fare",
                        reference: sessionId ? String(sessionId) : null,
                        createdAt: new Date()
                    }
                }
            },
            { new: true }
        );

        if (!wallet) {
            return { success: false };
        }

        // Send low-balance warning (fire-and-forget)
        if (wallet.balance < LOW_BALANCE_THRESHOLD) {
            NotificationService.sendToUser(userId, {
                title: "Low Wallet Balance",
                body: `Your wallet balance is ₹${wallet.balance}. Please recharge to avoid payment issues.`,
                data: { balance: String(wallet.balance) }
            }).catch((err) => console.error("PUSH LOW-BALANCE ERROR:", err.message));
        }

        return { success: true, wallet };
    }
}

module.exports = WalletService;
