const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Loan = require('../models/loan');
const Contract = require('../models/contract');

// Base authentication middleware
const authenticate = async (req, res, next) => {
  try {
    // 1. Get token from headers
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }
    
    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Find user with valid token
    const user = await User.findOne({
      _id: decoded.id,
      'tokens.token': token  // Check token is still valid
    });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found or token invalid' });
    }

    // 4. Attach user and token to request
    req.user = user;
    req.token = token;
    next();
  } catch (e) {
    console.error('Authentication error:', e);
    
    if (e.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Authorization middleware for loan access
const authorizeLoanAccess = async (req, res, next) => {
  try {
    const loanId = req.params.loanId || req.params.id;
    if (!loanId) return next(); // Skip if no loan ID
    
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }
    
    // Get associated contract
    const contract = await Contract.findById(loan.contractID);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check if user is authorized to access this loan
    const isBorrower = loan.userID.equals(req.user._id);
    const isSponsor1 = contract.sponsorID_1.equals(req.user._id);
    const isSponsor2 = contract.sponsorID_2.equals(req.user._id);
    
    if (!(isBorrower || isSponsor1 || isSponsor2)) {
      return res.status(403).json({ error: 'Unauthorized loan access' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// User or admin authorization middleware
const authorizeUserOrAdmin = (req, res, next) => {
  if (req.user._id.toString() === req.params.id || req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Forbidden: Restricted to account owner or admin' });
};

module.exports = {
  authenticate,
  authorizeLoanAccess,
  requireAdmin,
  authorizeUserOrAdmin
};