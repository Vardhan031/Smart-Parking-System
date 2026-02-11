const jwt = require("jsonwebtoken");

const adminAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Expect: Authorization: Bearer <token>
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Only ADMIN allowed
        if (decoded.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        // Attach admin info to request
        req.admin = decoded;

        next();
    } catch (error) {
        console.error("AUTH ERROR:", error.message);
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

module.exports = adminAuth;
