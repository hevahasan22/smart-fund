const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Joi = require('joi');
const { Contract } = require('./contract');

// User Schema
const userSchema = new mongoose.Schema(
  {
    userFirstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: [/^[a-zA-Z ]+$/, 'First name can only contain letters and spaces']
    },
    userLastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
       match: [/^[a-zA-Z ]+$/, 'Last name can only contain letters and spaces']
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      minlength: 4,
      maxlength: 100,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    phoneNumber: {
      type: String,
      required: true,
      validate: {
      validator: (v) => /^[0-9]{10,15}$/.test(v),
      message: 'Phone number must be 10-15 digits'
      }
    },
    DateOfBirth: {
      type: Date,
      required: true,
      validate: {
      validator: function(v) {
        const today = new Date();
        const birthDate = new Date(v);
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        return age > 18 || (age === 18 && monthDiff >= 0);
      },
      message: 'You must be at least 18 years old'
      }
    },
    address: {
      type: String,
      required: false,
    },
    gender:{
      type:String,
      enum:['female','male']
    },
    creditID: { 
      type: String, 
      required:false,
      default: undefined,
      validate: {
        validator: (v) => /^[a-zA-Z0-9]{8,20}$/.test(v),
        message: 'Invalid credit ID format'
        }
    },
    income: {
      type:Number,
      required:true,
    },
    status: {
      type:String,
      enum: ['eligible', 'max_sponsors_reached','inactive'], 
      default: 'eligible'
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    loanRole: {
    type: [String],
    enum: ['borrower', 'sponsor'],
    default: ['borrower']
   },
    pendingApprovals: [{
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    borrowerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now }
  }],
  notifications: [{
    type: { type: String, required: true }, // e.g., 'contract_approved'
    message: { type: String, required: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract' },
    createdAt: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }
  }],
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
    isActive: {
    type: Boolean,
    default: true, // Users are active by default
}

  },
  {
    timestamps: true,
  }
);


// Change your index definition to:
userSchema.index(
  { creditID: 1 },
  {
    name: "creditID_unique_partial", // Unique name
    unique: true,
    partialFilterExpression: { creditID: { $type: "string" } }
  }
);

// Update sponsor status when they reach limit
userSchema.methods.updateSponsorStatus = async function() {
  const activeSponsorships = await Contract.countDocuments({
    $or: [{ sponser: this._id }, { sponser: this._id }],
    status: { $in: ['approved', 'active'] }
  });
  
  this.status = activeSponsorships >= 2 ? 'max_sponsors_reached' : 'eligible';
  await this.save();
};

// Validation functions
function validateRegisterUser(obj) {
  const schema = Joi.object({
    email: Joi.string().trim().min(4).max(100).required().email(),
    userFirstName: Joi.string().trim().min(3).max(20).required(),
    userLastName: Joi.string().trim().min(3).max(20).required(),
    password: Joi.string().min(8).required(),
    phoneNumber: Joi.string().required().pattern(/^[0-9]{10,15}$/),
    address: Joi.string().optional(),
    DateOfBirth: Joi.date().required(),
    gender: Joi.string().valid('female', 'male').optional(),
    employmentStatus: Joi.string().valid('student', 'employee', 'unemployed', 'employed', 'self-employed').optional(),
    income: Joi.number().required(),
    creditID: Joi.string().optional(),
  });
  return schema.validate(obj);
}

function validateLoginUser(obj) {
  const schema = Joi.object({
    email: Joi.string().trim().min(4).max(100).required().email(),
    password: Joi.string().min(8).required(),
  });
  return schema.validate(obj);
}

function ValidateUpdateUser(obj) {
  const schema = Joi.object({
    email: Joi.string().trim().min(4).max(100).email(),
    userFirstName: Joi.string().trim().min(3).max(20),
    userLastName: Joi.string().trim().min(3).max(20),
    password: Joi.string().min(8),
    phoneNumber: Joi.string().pattern(/^[0-9]{10,15}$/),
    DateOfBirth: Joi.date(),
    address: Joi.string().trim().min(4).max(100),
    creditID: Joi.string().allow(null, '').optional(),
    gender: Joi.string().valid('female', 'male').optional(),
    employmentStatus:Joi.string().valid('student','employee','unemploeed').optional(),
    income: Joi.number(),
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
const User = mongoose.model('User', userSchema);

// Exports
module.exports = {
  User,
  validateRegisterUser,
  validateLoginUser,
  validateVerifyUser,
  validateResendOtp, // Added
};