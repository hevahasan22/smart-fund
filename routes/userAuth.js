const express = require('express');
const router = express.Router();
const { validateRegisterUser, validateLoginUser, validateVerifyUser,validateResendOtp } = require('../models/user');
const userController = require('../controllers/userAuthController');
const upload = require('../middleware/multer');
const {authenticate} = require('../middleware/auth');


router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/verify', userController.verifyEmail);
router.post('/resend-otp',userController.resendOtp)
router.get('/:userId', userController.getUser);
router.put('/update/:userId',authenticate, upload.single('profilePhoto'), userController.updateUser);


module.exports = router;