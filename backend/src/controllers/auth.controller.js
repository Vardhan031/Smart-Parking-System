const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AdminUser = require("../models/AdminUser");

class AuthController {
    static async login(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Username and password required"
                });
            }

            const admin = await AdminUser.findOne({ username });

            if (!admin || !admin.active) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid credentials"
                });
            }

            const valid = await bcrypt.compare(password, admin.passwordHash);
            if (!valid) {
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

            return res.json({
                success: true,
                token
            });
        } catch (err) {
            console.error("LOGIN ERROR:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });
        }
    }
}

module.exports = AuthController;
