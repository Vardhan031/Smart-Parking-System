const { getMessaging } = require("../config/firebase");
const User = require("../models/User");

class NotificationService {
    /**
     * Send a push notification to a single device.
     * @param {Object} opts
     * @param {string} opts.fcmToken  - Device FCM registration token
     * @param {string} opts.title     - Notification title
     * @param {string} opts.body      - Notification body
     * @param {Object} [opts.data]    - Optional key-value data payload
     * @returns {Promise<{success: boolean, messageId?: string}>}
     */
    static async send({ fcmToken, title, body, data = {} }) {
        const messaging = getMessaging();
        if (!messaging) {
            console.warn("PUSH: Firebase not configured, skipping notification");
            return { success: false };
        }

        if (!fcmToken) {
            return { success: false };
        }

        try {
            const message = {
                token: fcmToken,
                notification: { title, body },
                data: Object.fromEntries(
                    Object.entries(data).map(([k, v]) => [k, String(v)])
                )
            };

            const messageId = await messaging.send(message);
            return { success: true, messageId };
        } catch (err) {
            // Handle stale / invalid tokens
            if (
                err.code === "messaging/registration-token-not-registered" ||
                err.code === "messaging/invalid-registration-token"
            ) {
                console.warn("PUSH: Stale FCM token detected, clearing from user");
                await User.updateOne(
                    { fcmToken },
                    { $set: { fcmToken: null } }
                );
            } else {
                console.error("PUSH: Send failed:", err.message);
            }
            return { success: false };
        }
    }

    /**
     * Convenience: send a notification to a user by their userId.
     * Looks up the fcmToken from the User document.
     */
    static async sendToUser(userId, { title, body, data = {} }) {
        const user = await User.findById(userId).select("fcmToken").lean();
        if (!user || !user.fcmToken) return { success: false };

        return NotificationService.send({
            fcmToken: user.fcmToken,
            title,
            body,
            data
        });
    }
}

module.exports = NotificationService;
