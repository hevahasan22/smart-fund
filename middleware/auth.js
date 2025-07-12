const jwt = require('jsonwebtoken');
const { User, Contract, Loan, Document } = require('../models/index');

// Middleware: Authenticate user from JWT
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const user = await User.findById({
    _id: decoded.id,
    'tokens.token': token,
    isActive: true // Add this check
    });
    if (!user) {
      return res.status(401).json({ error: 'User not found or token invalid' });
    }

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
  console.log('Incoming auth header:', req.header('Authorization'));

};

// Middleware: Admin-only access
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Middleware: Loan access authorization
const authorizeLoanAccess = async (req, res, next) => {
  try {
    const loanId = req.params.loanId || req.params.id;
    if (!loanId) return next();

    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const contract = await Contract.findById(loan.contractID);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const isBorrower = loan.userID.equals(req.user._id);
    const isSponsor1 = contract.sponsorID_1 && contract.sponsorID_1.equals(req.user._id);
    const isSponsor2 = contract.sponsorID_2 && contract.sponsorID_2.equals(req.user._id);

    if (!(isBorrower || isSponsor1 || isSponsor2)) {
      return res.status(403).json({ error: 'Unauthorized loan access' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Middleware: Allow self or admin
const authorizeUserOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  if (req.user._id.toString() === req.params.id || req.user.role === 'admin') {
    return next();
  }

  res.status(403).json({ error: 'Forbidden: Restricted to account owner or admin' });
};

// Middleware: Document access authorization
const authorizeDocumentAccess = async (req, res, next) => {
  try {
    const docId = req.params.docId || req.params.id;
    if (!docId) return next();

    const document = await Document.findById(docId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Allow document owner, associated loan users, or admin
    const isOwner = document.uploadedBy.equals(req.user._id);
    const isLoanUser = document.loanID?.equals(req.user._id);
    
    if (!(isOwner || isLoanUser || req.user.role === 'admin')) {
      return res.status(403).json({ error: 'Unauthorized document access' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Contract access check helper
const checkContractAccess = async (req, res, next) => {
  try {
    const contractId = req.params.contractId || req.params.id;
    if (!contractId) return next();

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Allow borrower, sponsors, or admin
    const isBorrower = contract.userID.equals(req.user._id);
    const isSponsor1 = contract.sponsorID_1 && contract.sponsorID_1.equals(req.user._id);
    const isSponsor2 = contract.sponsorID_2 && contract.sponsorID_2.equals(req.user._id);
    
    if (!(isBorrower || isSponsor1 || isSponsor2 || req.user.role === 'admin')) {
      return res.status(403).json({ error: 'Unauthorized contract access' });
    }

    req.contract = contract; // Attach contract to request object
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  authorizeLoanAccess,
  authorizeUserOrAdmin,
  authorizeDocumentAccess,
  checkContractAccess
};
