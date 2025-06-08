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
      match: [/^[a-zA-Z ]+$/, 'First name can only contain letters and spaces']
    },
    userLastName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
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
      type: Number,
      required: false,
      unique:true,
      validate: {
      validator: (v) => /^[0-9]{10,15}$/.test(v),
      message: 'Phone number must be 10-15 digits'
      }
    },
    DateOfBirth: {
      type: Date,
      required: false,
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
    status: {
          type:String,
          enum: ['eligible', 'max_sponsors_reached'], 
          default: 'eligible'
    },
     creditID: { 
          type: String, 
          required: false, 
          unique: true,
          validate: {
            validator: (v) => /^[a-zA-Z0-9]{8,20}$/.test(v),
            message: 'Invalid credit ID format'
          }
    },
    income: {
          type:Number,
          required:true,
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

// Update sponsor status when they reach limit
userSchema.methods.updateSponsorStatus = async function() {
  const activeSponsorships = await Contract.countDocuments({
    $or: [{ sponser: this._id }, { sponser: this._id }],
    status: { $in: ['approved', 'active'] }
  });
  
  this.status = activeSponsorships >= 2 ? 'max_sponsors_reached' : 'eligible';
  await this.save();
};

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

//Validate Update User Informations
function ValidateUpdateUser(obj) {
  const schema=Joi.object({
    email: Joi.string().trim().min(4).max(100).required().email(),
    userFirstName: Joi.string().trim().min(4).max(20).required(),
    userLastName: Joi.string().trim().min(4).max(20).required(),
    password: Joi.string().min(8).required(),
    phoneNumber: Joi.string().pattern(/^\+?[\d\s-]{10,}$/),
    DateOfBirth: Joi.date(),
    address: Joi.string().trim().min(4).max(100),
    
  })  
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