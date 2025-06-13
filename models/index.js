const User = require('./user');
const Contract = require('./contract');
const AdditionalDocument = require('./additionalDocument');
const AdditionalDocumentType = require('./additionalDocumentType');
const Payment = require('./payment');
const Loan = require('./loan');
const Investor = require('./investor');
const TypeTerm = require('./typeterm');
const LoanType = require('./loanType');
const LoanTerm = require('./loanTerm');
const Sponsor=require('./sponsor')

module.exports = {
  User,
  Contract,
  AdditionalDocument,
  AdditionalDocumentType,
  Payment,
  Loan,
  Investor,
  TypeTerm,
  LoanType,
  LoanTerm,
  Sponsor
};