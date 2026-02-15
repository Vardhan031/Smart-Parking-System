const admin = require("firebase-admin");

let firebaseApp = null;

function getFirebaseApp() {
    if (firebaseApp) return firebaseApp;

    try {
        let credential;

        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            // JSON string passed directly via env var
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            credential = admin.credential.cert(serviceAccount);
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
            // Path to a JSON key file
            const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            credential = admin.credential.cert(serviceAccount);
        } else {
            console.warn(
                "FIREBASE: No credentials configured. Push notifications will be disabled."
            );
            return null;
        }

        firebaseApp = admin.initializeApp({ credential });
        console.log("Firebase Admin initialized");
    } catch (err) {
        console.error("Firebase Admin init failed:", err.message);
        return null;
    }

    return firebaseApp;
}

function getMessaging() {
    const app = getFirebaseApp();
    return app ? admin.messaging() : null;
}

module.exports = { getFirebaseApp, getMessaging };
