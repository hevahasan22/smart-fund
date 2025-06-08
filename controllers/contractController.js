const { Contract, validateContract } = require('../models/contract');
const { AdditionalDocument } = require('../models/additionalDocument');
const { Loan } = require('../models/loan');
const { Payment } = require('../models/payment');

exports.createContract = async (req, res) => {
  const { error } = validateContract(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const { userID, sponsorID_1, sponsorID_2, loanTypeID, loanTerm, employmentStatus, documents } = req.body;

  // Check sponsor availability
  const sponsor1Contracts = await Contract.find({ sponsorID_1 });
  const sponsor2Contracts = sponsorID_2 ? await Contract.find({ sponsorID_2 }) : [];
  if (sponsor1Contracts.length >= 2 || sponsor2Contracts.length >= 2) {
    return res.status(400).send('One or both sponsors have reached their contract limit');
  }

  // Validate documents
  const requiredDocs = await AdditionalDocumentType.find({ loanTypeID, isRequired: true });
  const uploadedDocTypes = documents.map(doc => doc.typeID);
  const missingDocs = requiredDocs.filter(doc => !uploadedDocTypes.includes(doc.typeID));
  if (missingDocs.length > 0) {
    return res.status(400).send('Missing required documents');
  }

  // Create contract
  const contract = new Contract({ userID, sponsorID_1, sponsorID_2, status: 'pending' });
  await contract.save();

  // Save documents
  for (const doc of documents) {
    const additionalDoc = new AdditionalDocument({
      CID: `DOC${Date.now()}`,
      typeID: doc.typeID,
      contractID: contract.contractID,
      documentFile: doc.documentFile
    });
    await additionalDoc.save();
  }

  // Create loan
  const loan = new Loan({
    loanID: `LOAN${Date.now()}`,
    loanAmount: req.body.loanAmount,
    loanTerm,
    interestRate: req.body.interestRate,
    startDate: new Date(),
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + parseInt(loanTerm))),
    typeID: loanTypeID,
    investorID: req.body.investorID
  });
  await loan.save();

  // Create initial payment
  const payment = new Payment({
    paymentID: `PAY${Date.now()}`,
    dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    status: 'pending',
    loanID: loan.loanID
  });
  await payment.save();

  res.send({ contract, loan, payment });
};