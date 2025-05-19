const mongoose = require('mongoose');
const Joi = require('joi');

// User Schema
const userSchema = new mongoose.Schema(
  {
    userFirstName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 3,
      maxlength: 20,
    },
    userLastName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 4,
      maxlength: 100,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    phoneNumber: {
      type: Number,
      required: false,
    },
    DateOfBirth: {
      type: Date,
      required: false,
    },
    address: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    employmentStatus: {
      type: String,
      enum: ['employed', 'self-employed', 'unemployed'],
    },
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'contract',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
    },
    verificationCodeExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Validate Register User
function validateRegisterUser(obj) {
  const schema = Joi.object({
    email: Joi.string().trim().min(4).max(100).required().email(),
    userFirstName: Joi.string().trim().min(4).max(20).required(),
    userLastName: Joi.string().trim().min(4).max(20).required(),
    password: Joi.string().min(8).required(),
    phoneNumber: Joi.number(),
  });

  return schema.validate(obj);
}

// Validate Login User
function validateLoginUser(obj) {
  const schema = Joi.object({
    email: Joi.string().trim().min(4).max(100).required().email(),
    password: Joi.string().trim().min(4).max(20).required(),
  });

  return schema.validate(obj);
}

// Validate Verify User
function validateVerifyUser(obj) {
  const schema = Joi.object({
    email: Joi.string().trim().min(4).max(100).required().email(),
    code: Joi.string().length(6).required(),
  });

  return schema.validate(obj);
}

// Validate Resend OTP
function validateResendOtp(obj) {
  const schema = Joi.object({
    email: Joi.string().trim().min(4).max(100).required().email(),
  });

  return schema.validate(obj);
}

// Model
const userModel = mongoose.model('user', userSchema);

// Exports
module.exports = {
  userModel,
  validateRegisterUser,
  validateLoginUser,
  validateVerifyUser,
  validateResendOtp, // Added
};