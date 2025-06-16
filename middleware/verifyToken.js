const jwt = require("jsonwebtoken");

// Verify Token (Basic Authentication)
const verifyToken = (req, res, next) => {
// Add this to the top of your controller
const { verifyTokenAndAdmin } = require('../middlewares/auth');

// Update user role function with additional security
exports.updateUserRole = async (req, res) => {
    try {
        // Prevent self-role demotion
        if (req.params.id === req.user.id && req.body.role !== 'admin') {
            return res.status(403).json({
                message: "You cannot remove your own admin privileges"
            });
        }

        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password -__v');
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Add admin activity logging to sensitive operations
exports.deleteUser = async (req, res) => {
    try {
        // Prevent self-deletion
        if (req.params.id === req.user.id) {
            return res.status(403).json({
                message: "You cannot delete your own account"
            });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        ).select('-password -__v');
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({ message: 'User deactivated', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.user = decoded;  // Attach decoded user payload to request
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

// Verify Token + User Authorization (Self or Admin)
const verifyTokenAndAuthorization = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.id === req.params.id || req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ message: "Forbidden: Restricted to account owner or admin" });
        }
    });
};

// Verify Token + Admin Authorization
const verifyTokenAndAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ message: "Forbidden: Admin access required" });
        }
    });
};

module.exports = {
    verifyToken,
    verifyTokenAndAuthorization,
    verifyTokenAndAdmin
};