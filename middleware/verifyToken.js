const jwt = require("jsonwebtoken");

// Verify Token (Basic Authentication)
function verifyToken(req, res, next) {
    const token = req.headers.token;
    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.user = decoded;  // Attach decoded user payload to request
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
}

// Verify Token + User Authorization (Self or Admin)
function verifyTokenAndAuthorization(req, res, next) {
    verifyToken(req, res, () => {
        if (req.user.id === req.params.id || req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ message: "Forbidden: Restricted to account owner or admin" });
        }
    });
}

// Verify Token + Admin Authorization
function verifyTokenAndAdmin(req, res, next) {
    verifyToken(req, res, () => {
        if (req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ message: "Forbidden: Admin access required" });
        }
    });
}

module.exports = {
    verifyToken,
    verifyTokenAndAuthorization,
    verifyTokenAndAdmin
};