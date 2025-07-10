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
        ref:'loanType',
        required:true
    },
    loanTermID:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'loanTerm',
        required:true
    } ,
      interestRate:{
        type:Number,
        required:true,
        min: [0, 'Interest rate cannot be negative']
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
        interestRate: Joi.number().min(0).required()
    });
    return schema.validate(data);
};


module.exports={
  typetermModel,
  validateTypeTerm
}