const { User } = require('../models/user');
const { Contract } = require('../models/contract');

exports.list = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const user = await User.findById(req.user._id).select('notifications');
    const excludedTypes = new Set(['sponsorship_request', 'sponsor_request']);
    const notifications = (user?.notifications || [])
      .filter(n => !excludedTypes.has(n.type))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');
    const excludedTypes = new Set(['sponsorship_request', 'sponsor_request']);
    const count = (user?.notifications || []).filter(n => !n.isRead && !excludedTypes.has(n.type)).length;
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await User.updateOne(
      { _id: req.user._id, 'notifications._id': id },
      { $set: { 'notifications.$.isRead': true } }
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { 'notifications.$[].isRead': true } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

exports.clearAll = async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { notifications: [] } });
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
};

// New: sponsor requests endpoints backed by pendingApprovals
exports.listSponsorRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'pendingApprovals.contractId',
        populate: [
          { path: 'userID', select: 'userFirstName userLastName email' },
          { path: 'typeTermID', populate: { path: 'loanTypeID', select: 'loanName' } }
        ]
      })
      .populate('pendingApprovals.borrowerId', 'userFirstName userLastName email');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sponsorRequests = (user?.pendingApprovals || [])
      .map(approval => {
        const contract = approval.contractId;
        const borrower = approval.borrowerId;
        
        if (!contract || !borrower) {
          console.warn('Missing contract or borrower data for approval:', approval._id);
          return null;
        }

        // Get loan type name
        const loanTypeName = contract.typeTermID?.loanTypeID?.loanName || 'Unknown Loan Type';
        
        // Format the message
        const message = `Action Required: ${borrower.userFirstName} ${borrower.userLastName} has requested you to sponsor their $${contract.tempLoanAmount} ${loanTypeName} (${contract.tempLoanTermMonths} months)`;
        
        return {
          id: approval._id,
          contractId: contract._id,
          borrower: {
            id: borrower._id,
            firstName: borrower.userFirstName,
            lastName: borrower.userLastName,
            email: borrower.email
          },
          loanDetails: {
            amount: contract.tempLoanAmount,
            term: contract.tempLoanTermMonths,
            type: loanTypeName
          },
          message: message,
          requestedAt: approval.requestedAt
        };
      })
      .filter(Boolean) // Remove null entries
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    res.json({ sponsorRequests });
  } catch (error) {
    console.error('Error in listSponsorRequests:', error);
    res.status(500).json({ error: 'Failed to fetch sponsor requests' });
  }
};

exports.countSponsorRequests = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('pendingApprovals');
    const count = (user?.pendingApprovals || []).length;
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sponsor requests count' });
  }
}; 