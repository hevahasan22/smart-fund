const { User, Contract, Payment, Investor, LoanType, LoanTerm } = require('../models/index');

     // Get all users with basic information
     exports.getAllUsers = async (req, res) => {
         try {
             const users = await User.find()
                 .select('userFirstName userLastName email role createdAt')
                 .lean();
             res.json({ success: true, users });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error fetching users', details: error.message });
         }
     };

     // Get detailed user information including contracts and payments
     exports.getUserDetails = async (req, res) => {
         try {
             const userId = req.params.id;
             
             const user = await User.findById(userId)
                 .select('-password -verificationCode -verificationCodeExpires')
                 .lean();
             
             if (!user || !user.isActive) {
                 return res.status(404).json({ success: false, error: 'User not found' });
             }

             const contracts = await Contract.find({ user: userId })
                 .populate('loanType sponsors')
                 .lean();

             const payments = await Payment.find({ user: userId })
                 .lean();

             res.json({
                 success: true,
                 user,
                 contracts,
                 paymentSchedule: payments
             });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error fetching user details', details: error.message });
         }
     };

     // Update user role
     exports.updateUserRole = async (req, res) => {
         try {
             // Prevent self-role demotion
             if (req.params.id === req.user.userId && req.body.role !== 'admin') {
                 return res.status(403).json({
                     success: false,
                     message: 'You cannot remove your own admin privileges'
                 });
             }

             const { role } = req.body;
             if (!['user', 'admin'].includes(role)) {
                 return res.status(400).json({ success: false, error: 'Invalid role' });
             }
             
             const user = await User.findByIdAndUpdate(
                 req.params.id,
                 { role },
                 { new: true }
             ).select('-password -verificationCode -verificationCodeExpires -__v');
             
             if (!user || !user.isActive) {
                 return res.status(404).json({ success: false, error: 'User not found' });
             }
             
             res.json({ success: true, user });
         } catch (error) {
             res.status(400).json({ success: false, error: error.message });
         }
     };

     // Delete (deactivate) a user
     exports.deleteUser = async (req, res) => {
         try {
             // Prevent self-deletion
             if (req.params.id === req.user.userId) {
                 return res.status(403).json({
                     success: false,
                     message: 'You cannot delete your own account'
                 });
             }

             // Check if user has active contracts
             const activeContracts = await Contract.find({ 
                 user: req.params.id, 
                 status: { $in: ['pending', 'approved'] }
             });

             if (activeContracts.length > 0) {
                 return res.status(400).json({ success: false, error: 'Cannot delete user with active contracts' });
             }

             const user = await User.findByIdAndUpdate(
                 req.params.id,
                 { isActive: false },
                 { new: true }
             ).select('-password -verificationCode -verificationCodeExpires -__v');
             
             if (!user) {
                 return res.status(404).json({ success: false, error: 'User not found' });
             }
             
             res.json({ success: true, message: 'User deactivated', user });
         } catch (error) {
             res.status(500).json({ success: false, error: error.message });
         }
     };

     // Review contract details
     exports.reviewContract = async (req, res) => {
         try {
             const contractId = req.params.contractId;
             
             const contract = await Contract.findById(contractId)
                 .populate('user loanType sponsors')
                 .lean();

             if (!contract) {
                 return res.status(404).json({ success: false, error: 'Contract not found' });
             }

             const payments = await Payment.find({ contract: contractId }).lean();

             res.json({
                 success: true,
                 contract,
                 documents: contract.documents,
                 payments
             });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error reviewing contract', details: error.message });
         }
     };

     // Update contract status
     exports.updateContractStatus = async (req, res) => {
         try {
             const { status, rejectionReason } = req.body;
             const contractId = req.params.contractId;

             if (!['approved', 'rejected'].includes(status)) {
                 return res.status(400).json({ success: false, error: 'Invalid status' });
             }

             const updateData = { status };
             if (status === 'rejected' && rejectionReason) {
                 updateData.rejectionReason = rejectionReason;
             }

             const contract = await Contract.findByIdAndUpdate(
                 contractId,
                 updateData,
                 { new: true }
             );

             if (!contract) {
                 return res.status(404).json({ success: false, error: 'Contract not found' });
             }

             res.json({ success: true, message: 'Contract status updated', contract });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error updating contract status', details: error.message });
         }
     };

     // Add new investor
     exports.addInvestor = async (req, res) => {
         try {
             const { name, email, investmentCapacity } = req.body;
             
             const investor = new Investor({
                 name,
                 email,
                 investmentCapacity,
                 status: 'active'
             });

             await investor.save();
             res.status(201).json({ success: true, message: 'Investor added successfully', investor });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error adding investor', details: error.message });
         }
     };

     // Get all investors
     exports.getAllInvestors = async (req, res) => {
         try {
             const investors = await Investor.find().lean();
             res.json({ success: true, investors });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error fetching investors', details: error.message });
         }
     };

     // Add new loan type
     exports.addLoanType = async (req, res) => {
         try {
             const { name, description, requiredDocuments } = req.body;
             
             const loanType = new LoanType({
                 name,
                 description,
                 requiredDocuments
             });

             await loanType.save();
             res.status(201).json({ success: true, message: 'Loan type added successfully', loanType });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error adding loan type', details: error.message });
         }
     };

     // Update loan type
     exports.updateLoanType = async (req, res) => {
         try {
             const { name, description, requiredDocuments } = req.body;
             const typeId = req.params.typeId;

             const loanType = await LoanType.findByIdAndUpdate(
                 typeId,
                 { name, description, requiredDocuments },
                 { new: true }
             );

             if (!loanType) {
                 return res.status(404).json({ success: false, error: 'Loan type not found' });
             }

             res.json({ success: true, message: 'Loan type updated successfully', loanType });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error updating loan type', details: error.message });
         }
     };

     // Add new loan term
     exports.addLoanTerm = async (req, res) => {
         try {
             const { duration, interestRate, loanType } = req.body;
             
             const loanTerm = new LoanTerm({
                 duration,
                 interestRate,
                 loanType
             });

             await loanTerm.save();
             res.status(201).json({ success: true, message: 'Loan term added successfully', loanTerm });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error adding loan term', details: error.message });
         }
     };

     // Update loan term
     exports.updateLoanTerm = async (req, res) => {
         try {
             const { duration, interestRate, loanType } = req.body;
             const termId = req.params.termId;

             const loanTerm = await LoanTerm.findByIdAndUpdate(
                 termId,
                 { duration, interestRate, loanType },
                 { new: true }
             );

             if (!loanTerm) {
                 return res.status(404).json({ success: false, error: 'Loan term not found' });
             }

             res.json({ success: true, message: 'Loan term updated successfully', loanTerm });
         } catch (error) {
             res.status(500).json({ success: false, error: 'Error updating loan term', details: error.message });
         }
     };