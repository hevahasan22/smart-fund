const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { User, validateRegisterUser, validateLoginUser, ValidateUpdateUser } = require('../models/user');
const path = require('path');
const crypto = require('crypto');

// Nodemailer setup (using Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register a new user
exports.register = async (req, res) => {
  const { error } = validateRegisterUser(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  try {
    const { email, password, userFirstName, userLastName, employmentStatus,phoneNumber,
      DateOfBirth,address,gender,income,creditID
     } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // Expires in 15 minutes

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user (unverified)
    const user = new User({
    email,
    userFirstName,
    userLastName,
    employmentStatus,
    phoneNumber,       
    DateOfBirth,        
    address,
    gender,
    income,             
    creditID,
    password: hashedPassword,
    isVerified: false,
    verificationCode,
    verificationCodeExpires,
    });

    const result = await user.save();

    // Send verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify Your Email - Loan Management System',
      html: `
        <h3>Email Verification</h3>
        <p>Your one-time verification code is: <b>${verificationCode}</b></p>
        <p>This code is valid for 10 minutes. Please enter it to complete registration.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for the verification code.',
      user: { id: result._id, email: result.email, fullName: `${result.userFirstName} ${result.userLastName}` },
    });
  } catch (error) {
    console.error('Error in register:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Resend OTP
exports.resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    // Generate new OTP
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Update user
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;
    await user.save();

    // Send verification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'New Verification Code - Loan Management System',
      html: `
        <h3>New Verification Code</h3>
        <p>Your new one-time verification code is: <b>${verificationCode}</b></p>
        <p>This code is valid for 10 minutes.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'New verification code sent successfully' });
  } catch (error) {
    console.error('Error in resendOtp:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  const { error } = validateLoginUser(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if verified
    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    // Check password
    const correctPassword = await bcrypt.compare(password, user.password);
    if (!correctPassword) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    // Generate JWT
   const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);


    res.json({
      success: true,
      message: 'Welcome back',
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: `${user.userFirstName} ${user.userLastName}`,
        role: user.role,
        profilePhoto: user.profilePhoto,
      },
    });
  } catch (error) {
    console.error('Error in login:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Verify email
exports.verifyEmail = async (req, res) => {
  const { email, code } = req.body;

  // Basic validation
  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required' });
  }

  try {
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already verified
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    // Check code and expiration
    if (user.verificationCode !== code || user.verificationCodeExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    // Mark user as verified
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);


    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: `${user.userFirstName} ${user.userLastName}`,
        role: user.role,
        profilePhoto: user.profilePhoto,
      },
    });
  } catch (error) {
    console.error('Error in verifyEmail:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Request password reset: generate token, store hashed, email link
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // For privacy, always respond success
      return res.json({ success: true, message: 'the reset link was sent to your email' });
    }

    // Create token and hash it
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    const resetUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:3001'}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;


    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: normalizedEmail,
      subject: 'Password Reset Instructions',
      html: `
        <p>You requested to reset your password.</p>
        <p>This link will expire in 10 minutes.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (mailErr) {
      // Cleanup if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      throw mailErr;
    }

    res.json({ success: true, message: 'the reset link was sent to your email' });
  } catch (error) {
    console.error('Error in requestPasswordReset:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Reset password: validate token, set new password, invalidate token
exports.resetPassword = async (req, res) => {
  try {
    const { email, token: bodyToken, newPassword } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    // Accept token from body or query string
    const tokenSource = bodyToken || req.query.token;
    if (!normalizedEmail || !tokenSource || !newPassword) {
      return res.status(400).json({ success: false, message: 'email, token and newPassword are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Normalize token: URL-decode and trim
    let rawToken = tokenSource;
    try { rawToken = decodeURIComponent(tokenSource); } catch (_) { /* ignore */ }
    rawToken = String(rawToken).trim();

    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
 
    let user = await User.findOne({
      email: normalizedEmail,
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    // Fallback for clients that send the already hashed token
    if (!user) {
      user = await User.findOne({
        email: normalizedEmail,
        passwordResetToken: rawToken,
        passwordResetExpires: { $gt: new Date() },
      });
    }

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const saltRounds = 12;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error in resetPassword:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get user 
exports.getUser = async (req, res) => {
  try {
    // Use the authenticated user's ID from the token
    const userId = req.user._id;
    
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log('User profile photo:', user.profilePhoto);
    console.log('User ID:', userId);
    
    res.json({
      success: true,
      user: {
        email: user.email,
        firstName:user.userFirstName,
        lastName:user.userLastName,
        gender: user.gender,
        income: user.income,
        creditID: user.creditID,
        address: user.address,
        DateOfBirth: user.DateOfBirth,
        phoneNumber: user.phoneNumber,
        profilePhoto: user.profilePhoto
      },
    });
  } catch (error) {
    console.error('Error in getUser:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Update user information (including profile photo)
exports.updateUser = async (req, res) => {
  // Use the authenticated user's ID from the token
  const userId = req.user._id;
  
  console.log('Update user request:', {
    userId: userId,
    body: req.body,
    hasFile: !!req.file
  });
  
  // Validate input (excluding file)
  const { error } = ValidateUpdateUser(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check for email uniqueness if email is being updated
    if (req.body.email && req.body.email !== user.email) {
      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }
    
    // Check for creditID uniqueness if creditID is being updated
    if (req.body.creditID && req.body.creditID !== user.creditID) {
      const existingUser = await User.findOne({ creditID: req.body.creditID });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Credit ID already exists' });
      }
    }
    // Update allowed fields
    const allowedFields = [
      'userFirstName', 'userLastName', 'email', 'phoneNumber', 'DateOfBirth',
      'address', 'creditID', 'gender', 'employmentStatus', 'income', 'profilePhoto'
    ];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });
    
    // Handle password update separately to hash it
    if (req.body.password !== undefined) {
      const saltRounds = 12;
      user.password = await bcrypt.hash(req.body.password, saltRounds);
    }
    
    // Handle DateOfBirth conversion if it's a string
    if (req.body.DateOfBirth !== undefined) {
      if (typeof req.body.DateOfBirth === 'string') {
        user.DateOfBirth = new Date(req.body.DateOfBirth);
      } else {
        user.DateOfBirth = req.body.DateOfBirth;
      }
    }
    
    // Handle gender case conversion - normalize to lowercase
    if (req.body.gender !== undefined) {
      user.gender = req.body.gender.toLowerCase();
    }
    
    // Handle income conversion to number
    if (req.body.income !== undefined) {
      user.income = Number(req.body.income);
    }
    
    // Handle phoneNumber conversion to string
    if (req.body.phoneNumber !== undefined) {
      user.phoneNumber = String(req.body.phoneNumber);
    }
    // Handle profile photo upload
    if (req.file) {
      console.log('Profile photo upload detected:', req.file.originalname);
      try {
        // Save file to disk (e.g., /uploads/profilePhotos/)
        const uploadDir = path.join(__dirname, '../uploads/profilePhotos');
        const fs = require('fs');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const ext = path.extname(req.file.originalname);
        const fileName = `${userId}_${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, req.file.buffer);
        user.profilePhoto = `/uploads/profilePhotos/${fileName}`;
        console.log('Profile photo saved:', user.profilePhoto);
      } catch (fileError) {
        console.error('Error saving profile photo:', fileError);
        return res.status(500).json({ 
          success: false, 
          message: 'Error saving profile photo. Please try again.' 
        });
      }
    } else {
      console.log('No profile photo file uploaded');
    }
      
    await user.save();
    
    console.log('User updated successfully:', user._id);
    
    res.json({ 
      success: true, 
      message: 'User updated successfully', 
      user: {
        id: user._id,
        email: user.email,
        fullName: `${user.userFirstName} ${user.userLastName}`,
        gender: user.gender,
        income: user.income,
        creditID: user.creditID,
        address: user.address,
        DateOfBirth: user.DateOfBirth,
        phoneNumber: user.phoneNumber,
        profilePhoto: user.profilePhoto
      }
    });
  } catch (error) {
    console.error('Error in updateUser:', error.message);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false, 
        message: `${field} already exists` 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: messages.join(', ') 
      });
    }
    
    res.status(500).json({ success: false, message: 'Unable to save profile. Please try again.' });
  }
};



// Test endpoint to upload profile photo
exports.testUpload = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log('Test upload - User ID:', userId);
    console.log('Test upload - File:', req.file);
    
    if (req.file) {
      // Save file to disk
      const uploadDir = path.join(__dirname, '../uploads/profilePhotos');
      const fs = require('fs');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const ext = path.extname(req.file.originalname);
      const fileName = `test_${userId}_${Date.now()}${ext}`;
      const filePath = path.join(uploadDir, fileName);
      
      // Write file
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Update user profile photo
      user.profilePhoto = `/uploads/profilePhotos/${fileName}`;
      await user.save();
      
      console.log('Test upload - File saved:', user.profilePhoto);
      
      res.json({
        success: true,
        message: 'Test upload successful',
        profilePhoto: user.profilePhoto,
        fileInfo: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
        body: req.body,
        files: req.files
      });
    }
  } catch (error) {
    console.error('Error in testUpload:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};