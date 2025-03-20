const mongoose=require('mongoose')
const joi=require('joi')
//user schema
const userSchema=new mongoose.Schema(
    {
       userFirstName:
       {
         type:String,
         required:true,
         trim:true,
         unique:true,
         minlength:3,
         maxlength:20
       },
       userLastName:
       {
         type:String,
         required:true,
         trim:true,
         unique:true,
         minlength:3,
         maxlength:20
       },
       email:
       {
         type:String,
         unique:true,
         required:true,
         trim:true,
         minlength:4,
         maxlength:100
       },
       password:
       {
         type:String,
         required:true,
         minlength:8
       },
       phoneNumber:
       {
         type:Number,
         required:true,
       },
       DateOfBirth:
       {
         type:Date,
         required:false
       },
       address:
       {
         type:String,
         required:false
       },
       isAdmin:
       {
         type:Boolean,
         default:false
       },
       statues:
       {
        type:Boolean,
        required:true,
       },
       accountNumber:
       {
        type:Number,
        required:true
       },
       income:
       {
        type:String,
        requires:true
       },
       contract:
       {
        type:mongoose.Schema.Types.ObjectId,
        ref:'contract',
        required:true
       }
    },
    {
      timestamps:true
    }
)

// Validate Register User
function validateRegisterUser (obj){
   const schema=joi.object(
    {
      email:joi.string().trim().min(4).max(100).required().email(),
      userFirstName:joi.string().trim().min(4).max(20).required(),
      userLastName:joi.string().trim().min(4).max(20).required(),
      password:joi.string().min(8).required(),
      phoneNumber:joi.number().required(),
    }
   );
   return schema.validate(obj);
}
//validate login user

function validateLoginUser(obj){
  const schema=joi.object(
    {
      email:joi.string().trim().min(4).max(100).required().email(),
      password:joi.string().trim().min(4).max(20).required()
    }
  )
}

const userModel=mongoose.model('user',userSchema)
//export
module.exports={
    userModel,
    validateRegisterUser,
    validateLoginUser
}