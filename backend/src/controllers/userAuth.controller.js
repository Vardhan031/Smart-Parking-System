const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const normalizeEmail = (email = "") => String(email).trim().toLowerCase();
const requestMeta = (req) => ({
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
});

class UserAuthController {
    static async register(req, res) {
        const { name, email, phone, password, vehiclePlates } = req.body || {};
        const normalizedEmail = normalizeEmail(email);
        try {
            console.info("[USER REGISTER] Request received", {
                ...requestMeta(req),
                email: normalizedEmail,
                hasPhone: !!phone,
                vehiclePlatesCount: Array.isArray(vehiclePlates) ? vehiclePlates.length : 0
            });

            if (!name || !normalizedEmail || !password) {
                console.warn("[USER REGISTER] Validation failed", {
                    ...requestMeta(req),
                    email: normalizedEmail,
                    hasName: !!name,
                    hasEmail: !!normalizedEmail,
                    hasPassword: !!password
                });
                return res.status(400).json({
                    success: false,
                    message: "Name, email and password are required"
                });
            }
            const existingUser = await User.findOne({ email: normalizedEmail });
            if (existingUser) {
                console.warn("[USER REGISTER] Duplicate email", {
                    ...requestMeta(req),
                    email: normalizedEmail
                });
                return res.status(409).json({
                    success: false,
                    message: "Email already registered"
                });
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const user = await User.create({
                name,
                email: normalizedEmail,
                phone: phone || undefined,
                passwordHash,
                vehiclePlates: vehiclePlates || []
            });
            if (!process.env.JWT_SECRET) {
                console.error("[USER REGISTER] JWT secret missing before token creation", {
                    ...requestMeta(req),
                    email: normalizedEmail
                });
            }

            const token = jwt.sign(
                { id: user._id, role: "USER" },
                process.env.JWT_SECRET,
                { expiresIn: "8h" }
            );

            console.info("[USER REGISTER] Success", {
                ...requestMeta(req),
                email: normalizedEmail,
                userId: String(user._id)
            });

            return res.status(201).json({
                success: true,
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone || null,
                    vehiclePlates: user.vehiclePlates
                }
            });
        } catch (err) {
            console.error("[USER REGISTER] Error", {
                ...requestMeta(req),
                email: normalizedEmail,
                message: err.message,
                stack: err.stack
            });
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }

    static async login(req, res) {
        const { email, password } = req.body || {};
        const normalizedEmail = normalizeEmail(email);
        try {
            console.info("[USER LOGIN] Request received", {
                ...requestMeta(req),
                email: normalizedEmail,
                passwordLength: password ? String(password).length : 0
            });

            if (!normalizedEmail || !password) {
                console.warn("[USER LOGIN] Validation failed", {
                    ...requestMeta(req),
                    email: normalizedEmail,
                    hasEmail: !!normalizedEmail,
                    hasPassword: !!password
                });
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required"
                });
            }
            const user = await User.findOne({ email: normalizedEmail });

            if (!user || !user.active) {
                console.warn("[USER LOGIN] User not found or inactive", {
                    ...requestMeta(req),
                    email: normalizedEmail,
                    userFound: !!user,
                    active: user ? !!user.active : null
                });
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials"
                });
            }
            if (!process.env.JWT_SECRET) {
                console.error("[USER LOGIN] JWT secret missing before token creation", {
                    ...requestMeta(req),
                    email: normalizedEmail,
                    userId: String(user._id)
                });
            }

            const valid = await bcrypt.compare(password, user.passwordHash);
            if (!valid) {
                console.warn("[USER LOGIN] Password mismatch", {
                    ...requestMeta(req),
                    email: normalizedEmail,
                    userId: String(user._id)
                });
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials"
                });
            }

            const token = jwt.sign(
                { id: user._id, role: "USER" },
                process.env.JWT_SECRET,
                { expiresIn: "8h" }
            );

            console.info("[USER LOGIN] Success", {
                ...requestMeta(req),
                email: normalizedEmail,
                userId: String(user._id)
            });

            return res.json({
                success: true,
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone || null,
                    vehiclePlates: user.vehiclePlates
                }
            });
        } catch (err) {
            console.error("[USER LOGIN] Error", {
                ...requestMeta(req),
                email: normalizedEmail,
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

module.exports = UserAuthController;
