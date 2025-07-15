// Import all models to ensure they are registered with Mongoose
const { User, validateLoginUser, validateRegisterUser, validateVerifyUser, validateResendOtp } = require('./user');
const { Contract } = require('./contract');
const { additionalDocumentModel } = require('./additionalDocument');
const { additionalDocumentTypeModel, validateDocumentType } = require('./additionalDocumentType');
const { documentTypeTermRelationModel, validateDocumentTypeTermRelation } = require('./documentTypeTermRelation');
const { Payment } = require('./payment');
const { Loan } = require('./loan');
const { Investor } = require('./investor');
const { typetermModel, validateTypeTerm } = require('./typeterm');
const { loanTypeModel } = require('./loanType');
const { loanTermModel } = require('./loanTerm');

// Ensure all models are registered by accessing them
const models = {
  User,
  Contract,
  additionalDocumentModel,
  additionalDocumentTypeModel,
  documentTypeTermRelationModel,
  Payment,
  Loan,
  Investor,
  typetermModel,
  loanTypeModel,
  loanTermModel
};

// Log registered models for debugging
console.log('Registered models:', Object.keys(models));

module.exports = {
  User,
  Contract,
  additionalDocumentModel,
  additionalDocumentTypeModel,
  documentTypeTermRelationModel,
  Payment,
  Loan,
  Investor,
  typetermModel,
  loanTypeModel,
  loanTermModel,
  // Validation functions
  validateLoginUser,
  validateRegisterUser,
  validateVerifyUser,
  validateResendOtp,
  validateDocumentType,
  validateDocumentTypeTermRelation,
  validateTypeTerm
};