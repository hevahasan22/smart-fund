const express = require('express');
const app = express();
app.use(express.json());
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { userModel,validateRegisterUser ,validateLoginUser } = require('../models/user');
const mongoose=require('mongoose')
require('dotenv').config()

// Register a new user
exports.register = async (req, res) => {
  const {error}=validateRegisterUser(req.body);
  if(error){
      return res.status(400).json({message:error.details[0].message});
  }
      const existingUser = await userModel.findOne({email:req.body.email})
      if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
      }

       const saltRounds=12;
       const hashedPassword=await bcrypt.hash(req.body.password,saltRounds) 
       user=new userModel({
           email:req.body.email,
           userFirstName:req.body.userFirstName,
           userLastName:req.body.userLastName,
           password:hashedPassword, 
       })
       const result= await user.save();

      res.status(201).json({ message: 'User registered successfully' });
};

// Login user
exports.login = async (req, res) => {
  const {error}=validateLoginUser(req.body)
  if(error){
    return res.status(400).json({message:error.details[0].message});
  }
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email:req.body.email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const correctPassword=await bcrypt.compare(req.body.password,user.password)
      if(!correctPassword){
        return res.status(400).json({message: "invalid email or password"});
      }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    res.json({
    message: "Welcome back", token, user: { id: user._id, email: user.email, fullName: user.fullName, role: user.role }
   });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};