const express = require('express');
const router = express.Router();
const { validateRegisterUser, validateLoginUser, validateVerifyUser } = require('../models/user');
const userController = require('../controllers/userController');

const validate = (schema) => (req, res, next) => {
  const { error } = schema(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });
  next();
};

router.post('/register', validate(validateRegisterUser), userController.register);
router.post('/login', validate(validateLoginUser), userController.login);
router.post('/verify', validate(validateVerifyUser), userController.verifyEmail);
router.get('/:userId', userController.getUser);

module.exports = router;