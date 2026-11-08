const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, tenantContext } = require('../middleware/auth');
const { loginRateLimiter, registerRateLimiter, forgotPasswordRateLimiter, changePasswordRateLimiter } = require('../middleware/rateLimiter');

router.post('/register', registerRateLimiter, authController.register);
router.post('/login', loginRateLimiter, authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/change-password', authenticate, changePasswordRateLimiter, authController.changePassword);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/manager-override', authenticate, tenantContext, authController.managerOverride);

// Public password reset request & token status check
router.post('/forgot-password', forgotPasswordRateLimiter, authController.requestPasswordReset);
router.get('/forgot-password-status', authController.getResetRequestStatus);
router.get('/forgot-password-status/:token', authController.getResetRequestStatus);

module.exports = router;
