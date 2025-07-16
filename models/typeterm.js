const mongoose= require('mongoose')
const Joi=require('joi')
const typetermSchema=new mongoose.Schema({
    name:{
      type: String,
      required:true
    },
    loanTypeID:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'LoanType',
        required:true
    },
    loanTermID:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'LoanTerm',
        required:true
    } ,
      interestRate:{
        type:Number,
        required:true,
        min: [0, 'Interest rate cannot be negative']
    },  
    maxAmount:{
        type:Number,
        required:true,
        validate: {
          validator: function(v) {
            return v > this.minAmount;
          },
          message: 'Max amount must be greater than min amount'
        }
    },
    minAmount:{
        type:Number,
        required:true,
        min: [0, 'Minimum amount cannot be negative']
    },
}, {
  timestamps: true,
  autoIndex: false // Add this line to prevent automatic index creation
 })

const typetermModel=mongoose.model('typeterm',typetermSchema)

const validateTypeTerm = (data) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        loanTypeID: Joi.string().hex().length(24).required(),
        loanTermID: Joi.string().hex().length(24).required(),
        interestRate: Joi.number().min(0).required(),
        minAmount: Joi.number().min(0).required(),
        maxAmount: Joi.number().required().greater(Joi.ref('minAmount'))
    });
    return schema.validate(data);
};


module.exports={
  typetermModel,
  validateTypeTerm
}