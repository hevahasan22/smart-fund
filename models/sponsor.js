const mongoose = require('mongoose');

const sponsorSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  phoneNumber: {
    type: String,
    required: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Invalid phone number']
  },
  relationshipWithUser: {
    type: String,
    required: true,
    enum: ['parent', 'sibling', 'relative', 'employer', 'other']
  },
  income: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for active guarantees count
sponsorSchema.virtual('activeGuarantees', {
  ref: 'Contract',
  localField: '_id',
  foreignField: '$or',
  count: true,
  match: { status: { $in: ['approved', 'active'] } }
});

// Prevent duplicate sponsors for same user
sponsorSchema.index({ email: 1, userId: 1 }, { unique: true });

const Sponsor = mongoose.model('Sponsor', sponsorSchema);
module.exports = Sponsor;