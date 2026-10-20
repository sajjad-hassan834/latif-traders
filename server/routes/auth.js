const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/change-password', authenticate, authController.changePassword);
router.put('/profile', authenticate, authController.updateProfile);

// Public password reset request & status check
router.post('/forgot-password', authController.requestPasswordReset);
router.get('/forgot-password-status/:username', authController.getResetRequestStatus);

module.exports = router;
