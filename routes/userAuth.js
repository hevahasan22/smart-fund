const express = require('express');
const router = express.Router();
const { validateRegisterUser, validateLoginUser, validateVerifyUser,validateResendOtp } = require('../models/user');
const userController = require('../controllers/userController');

// const validate = (schema) => (req, res, next) => {
//   const { error } = schema(req.body); // Call the validation function
//   if (error) return res.status(400).json({ success: false, message: error.details[0].message });
//   next();
// };

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/verify', userController.verifyEmail);
router.post('/resend-otp',userController.resendOtp)
router.get('/:userId', userController.getUser);


module.exports = router;