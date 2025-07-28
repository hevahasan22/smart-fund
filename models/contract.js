const mongoose = require('mongoose');
const Joi = require('joi');

const contractSchema = new mongoose.Schema({
    status: { 
       type: String, 
       enum: ['pending_sponsor_approval', 'pending_document_approval', 'pending', 'pending_processing', 'approved', 'rejected', 'active', 'completed','pending_document_upload'], 
       default: 'pending' 
    },
    employmentStatus: {
      type: String,
      enum: ['Employed', 'Self-Employed', 'Unemployed', 'Student','Other'],
    },
    dateOfCreate: {
       type: Date, 
       default: Date.now 
    },
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    sponsorID_1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sponsorID_2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    typeTermID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'typeterm', // changed from 'TypeTerm' to 'typeterm'
        required: true
    },
    // Temporary loan details - will be moved to loan model after approval
    tempLoanAmount: {
        type: Number,
        required: true
    },
    tempLoanTermMonths: {
        type: Number,
        required: true
    },
    tempStartDate: {
        type: Date,
        default: Date.now
    },
    sponsor1Approved: {
        type: Boolean,
        default: false
    },
    sponsor2Approved: {
        type: Boolean,
        default: false
    },
    rejectionReason: {
        type: String
    },
    loanID: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Loan'
    },
    priority: {
        type: Number,
        default: 3
    },
    approvedAt: {
        type: Date 
    }  
}, {
    timestamps: true
});

// Sponsor validation hook
contractSchema.pre('save', async function(next) {
  try {
    if (this.isModified('sponsorID_1') || this.isModified('sponsorID_2') || this.isNew) {
      // 1. Check sponsor IDs are distinct
      if (this.sponsorID_1.toString() === this.sponsorID_2.toString()) {
        throw new Error('Sponsors must be different individuals');
      }
      
      // 2. Check sponsors are not the applicant
      if (this.sponsorID_1.toString() === this.userID.toString() || 
          this.sponsorID_2.toString() === this.userID.toString()) {
        throw new Error('You cannot be your own sponsor');
      }

      // Skip loan-related checks if loanID not set
      if (!this.loanID) return next();
      
      // 3. Get loan type - handle case where model might not be registered yet
      let Loan;
      try {
        Loan = mongoose.model('Loan');
      } catch (error) {
        console.warn('Loan model not registered yet, skipping loan validation');
        return next();
      }
      
      const loan = await Loan.findById(this.loanID)
        .populate({
          path: 'typeTermID',
          populate: { path: 'loanTypeID' }
        });
      
      if (!loan) throw new Error('Loan not found');
      
      const loanTypeId = loan.typeTermID.loanTypeID._id;
      const sponsors = [this.sponsorID_1, this.sponsorID_2];
      
      // 4. Check sponsor availability for loan type
      for (const sponsorId of sponsors) {
        const count = await mongoose.model('Contract').countDocuments({
          $or: [{ sponsorID_1: sponsorId }, { sponsorID_2: sponsorId }],
          status: { $in: ['approved', 'active'] },
          'loanID.typeTermID.loanTypeID': loanTypeId
        });
        
        if (count >= 2) {
          throw new Error(`Sponsor ${sponsorId} has reached guarantee limit for this loan type`);
        }
      }
      
      // 5. Set priority based on loan type
      this.priority = loan.typeTermID.loanTypeID.priority;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Update sponsor status when contract changes
contractSchema.post('save', async function(doc) {
  try {
    let User;
    try {
      User = mongoose.model('User');
    } catch (error) {
      console.warn('User model not registered yet, skipping sponsor status update');
      return;
    }
    
    const sponsors = await User.find({
      $or: [{ _id: doc.sponsorID_1 }, { _id: doc.sponsorID_2 }]
    });
    
    for (const sponsor of sponsors) {
      if (sponsor.updateSponsorStatus) {
        await sponsor.updateSponsorStatus();
      }
    }
  } catch (error) {
    console.error('Error updating sponsor status:', error);
  }
});

contractSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    try {
      let User;
      try {
        User = mongoose.model('User');
      } catch (error) {
        console.warn('User model not registered yet, skipping sponsor status update');
        return;
      }
      
      const sponsors = await User.find({
        $or: [{ _id: doc.sponsorID_1 }, { _id: doc.sponsorID_2 }]
      });
      
      for (const sponsor of sponsors) {
        if (sponsor.updateSponsorStatus) {
          await sponsor.updateSponsorStatus();
        }
      }
    } catch (error) {
      console.error('Error updating sponsor status:', error);
    }
  }
});

contractSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      let User;
      try {
        User = mongoose.model('User');
      } catch (error) {
        console.warn('User model not registered yet, skipping sponsor status update');
        return;
      }
      
      const sponsors = await User.find({
        $or: [{ _id: doc.sponsorID_1 }, { _id: doc.sponsorID_2 }]
      });
      
      for (const sponsor of sponsors) {
        if (sponsor.updateSponsorStatus) {
          await sponsor.updateSponsorStatus();
        }
      }
    } catch (error) {
      console.error('Error updating sponsor status:', error);
    }
  }
});

const Contract = mongoose.model('Contract', contractSchema);

module.exports = {
  Contract
};