const express = require('express');
const router = express.Router();
const { validateRegisterUser, validateLoginUser, validateVerifyUser,validateResendOtp } = require('../models/user');
const userController = require('../controllers/userAuthController');


router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/verify', userController.verifyEmail);
router.post('/resend-otp',userController.resendOtp)
router.get('/:userId', userController.getUser);


module.exports = router;