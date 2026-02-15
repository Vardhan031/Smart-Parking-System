const Wallet = require("../models/Wallet");

class UserWalletController {
    /**
     * GET / — Fetch wallet for authenticated user (auto-create if missing)
     */
    static async getWallet(req, res) {
        try {
            let wallet = await Wallet.findOne({ userId: req.user.id });

            if (!wallet) {
                wallet = await Wallet.create({ userId: req.user.id });
            }

            return res.json({
                success: true,
                data: {
                    balance: wallet.balance,
                    transactions: wallet.transactions
                }
            });
        } catch (err) {
            console.error("GET WALLET ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * POST /topup — Create a payment order for wallet top-up
     */
    static async topUp(req, res) {
        try {
            const { amount } = req.body;

            if (!amount || typeof amount !== "number" || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "A positive amount is required"
                });
            }

            // Ensure wallet exists
            let wallet = await Wallet.findOne({ userId: req.user.id });
            if (!wallet) {
                wallet = await Wallet.create({ userId: req.user.id });
            }

            // Record a pending CREDIT transaction
            wallet.transactions.push({
                type: "CREDIT",
                amount,
                description: "Wallet top-up (pending)",
                reference: null,
                createdAt: new Date()
            });
            await wallet.save();

            const pendingTxn = wallet.transactions[wallet.transactions.length - 1];

            // TODO: Replace with real Razorpay/Stripe order creation
            // For now, return a mock order that the client can use to initiate payment
            return res.json({
                success: true,
                data: {
                    orderId: pendingTxn._id,
                    amount,
                    currency: "INR",
                    status: "PENDING"
                }
            });
        } catch (err) {
            console.error("TOPUP ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    /**
     * POST /verify-payment — Confirm payment and credit wallet balance
     */
    static async verifyPayment(req, res) {
        try {
            const { orderId, paymentId } = req.body;

            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: "orderId is required"
                });
            }

            const wallet = await Wallet.findOne({ userId: req.user.id });
            if (!wallet) {
                return res.status(404).json({
                    success: false,
                    message: "Wallet not found"
                });
            }

            // Find the pending transaction
            const txn = wallet.transactions.id(orderId);
            if (!txn || txn.type !== "CREDIT") {
                return res.status(404).json({
                    success: false,
                    message: "Transaction not found"
                });
            }

            // TODO: Verify payment signature with Razorpay/Stripe here
            // For now, trust the callback and credit the balance

            txn.description = "Wallet top-up";
            txn.reference = paymentId || null;
            wallet.balance += txn.amount;
            await wallet.save();

            return res.json({
                success: true,
                data: {
                    balance: wallet.balance
                }
            });
        } catch (err) {
            console.error("VERIFY PAYMENT ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }
}

module.exports = UserWalletController;
