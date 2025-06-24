const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { User, validateRegisterUser, validateLoginUser } = require('../models/user');

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
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

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
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({
      success: true,
      message: 'Welcome back',
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: `${user.userFirstName} ${user.userLastName}`,
        role: user.role,
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
    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: `${user.userFirstName} ${user.userLastName}`,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error in verifyEmail:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// Get user by ID
exports.getUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        fullName: `${user.userFirstName} ${user.userLastName}`,
        employmentStatus: user.employmentStatus,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error in getUser:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};