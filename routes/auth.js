const express=require('express')
const bcrypt=require('bcryptjs')
// const app=express();
// app.use(express.json());
const asyncHandler = require('express-async-handler');
const router=express.Router();
const {validateRegisterUser, userModel}=require('../models/user')
const {checkUserExists,validateCredentials,isAuthenticated}=require('../middleware/auth')
const mongoose=require('mongoose')


//validateUserRegister
router.post('/api/register',asyncHandler(async(req,res)=>{
    const {error}=validateRegisterUser(req.body);
    if(error){
        return res.status(400).json({message:error.details[0].message});
    }
    const userExists=await userModel.findOne({email:req.body.email})
    if(userExists){
        res.status(400).json({message:'User already exists'})
    }

    const saltRounds=12;
    const hashedPassword=await bcrypt.hash(req.body.password,saltRounds) 
    user=new userModel({
        email:req.body.email,
        userFirstName:req.body.userFirstName,
        userLastName:req.body.userLastName,
        password:hashedPassword,
        phoneNumber:req.body.phoneNumber, 
    })
    const result= await user.save();

    res.status(201).json({
        message:'User registered succfully',
        user:{
            id: result._id,
            email: result.email,
            userFirstName: result.userFirstName,
            userLastName: result.userLastName, 
        },
    })
}))



module.exports=router;