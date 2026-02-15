const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AdminUser = require("../models/AdminUser");
const normalizeUsername = (username = "") => String(username).trim();
const requestMeta = (req) => ({
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
});

class AuthController {
    static async login(req, res) {
        const { username, password } = req.body || {};
        const normalizedUsername = normalizeUsername(username);
        try {
            console.info("[ADMIN LOGIN] Request received", {
                ...requestMeta(req),
                username: normalizedUsername,
                passwordLength: password ? String(password).length : 0
            });

            if (!normalizedUsername || !password) {
                console.warn("[ADMIN LOGIN] Validation failed", {
                    ...requestMeta(req),
                    username: normalizedUsername,
                    hasUsername: !!normalizedUsername,
                    hasPassword: !!password
                });
                return res.status(400).json({
                    success: false,
                    message: "Username and password required"
                });
            }
            const admin = await AdminUser.findOne({ username: normalizedUsername });

            if (!admin || !admin.active) {
                console.warn("[ADMIN LOGIN] Admin not found or inactive", {
                    ...requestMeta(req),
                    username: normalizedUsername,
                    adminFound: !!admin,
                    active: admin ? !!admin.active : null
                });
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials"
                });
            }
            if (!process.env.JWT_SECRET) {
                console.error("[ADMIN LOGIN] JWT secret missing before token creation", {
                    ...requestMeta(req),
                    username: normalizedUsername,
                    adminId: String(admin._id)
                });
            }

            const valid = await bcrypt.compare(password, admin.passwordHash);
            if (!valid) {
                console.warn("[ADMIN LOGIN] Password mismatch", {
                    ...requestMeta(req),
                    username: normalizedUsername,
                    adminId: String(admin._id)
                });
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials"
                });
            }

            const token = jwt.sign(
                {
                    id: admin._id,
                    role: admin.role
                },
                process.env.JWT_SECRET,
                { expiresIn: "8h" }
            );

            console.info("[ADMIN LOGIN] Success", {
                ...requestMeta(req),
                username: normalizedUsername,
                adminId: String(admin._id)
            });

            return res.json({
                success: true,
                token
            });
        } catch (err) {
            console.error("[ADMIN LOGIN] Error", {
                ...requestMeta(req),
                username: normalizedUsername,
                message: err.message,
                stack: err.stack
            });
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }
}

module.exports = AuthController;
