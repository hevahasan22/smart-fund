const user = require ('../models/user')
/**
 * Authentication middleware
 * - Checks if users exist
 * - Validates user credentials
 */

// Check if user exists by email
exports.checkUserExists = async (req, res, next) => {
    try {
      const { email } = req.body;
      
      const user = await user.findOne({ email });
      
      if (!user) {
        return res.status(404).json({ message: 'User not found with this email' });
      }
      
      // Attach user to request for later use
      req.user = user;
      next();
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };

  //validate user password
  exports.validateCredentials = async (req, res, next) => {
    try {
      const { password } = req.body;
      const user = req.user;
      
      const isPasswordValid = await user.comparePassword(password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Store user in session
      req.session.userId = user._id;
      req.session.userRole = user.role;
      
      next();
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };

  // Ensure user is authenticated
exports.isAuthenticated = async (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      const user = await user.findById(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Attach user data to request
      req.user = user;
      next();
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };