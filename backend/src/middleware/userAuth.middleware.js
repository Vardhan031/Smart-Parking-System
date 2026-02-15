const jwt = require("jsonwebtoken");
const requestMeta = (req) => ({
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
});

const userAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.warn("[USER AUTH MIDDLEWARE] Missing or invalid authorization header", {
                ...requestMeta(req),
                hasHeader: !!authHeader
            });
            return res.status(401).json({
                success: false,
                message: "Authorization token missing"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== "USER") {
            console.warn("[USER AUTH MIDDLEWARE] Role mismatch", {
                ...requestMeta(req),
                role: decoded.role,
                userId: decoded.id
            });
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        req.user = { id: decoded.id, role: decoded.role };
        console.info("[USER AUTH MIDDLEWARE] Authorized", {
            ...requestMeta(req),
            userId: decoded.id
        });

        next();
    } catch (error) {
        console.error("[USER AUTH MIDDLEWARE] Verification error", {
            ...requestMeta(req),
            message: error.message
        });
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

module.exports = userAuth;
