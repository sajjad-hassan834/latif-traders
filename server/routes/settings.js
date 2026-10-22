const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, requireRoles } = require('../middleware/auth');

// Public logo serving route
router.get('/logo/:tenantId/:filename', settingsController.serveLogo);

// Protected routes (strictly requiring authentication)
router.use(authenticate);

router.get('/', settingsController.getSettings);
router.put('/', requireRoles('admin'), settingsController.updateSettings);
router.post('/', requireRoles('admin'), settingsController.updateSettings);
router.get('/billing', settingsController.getBillingInfo);
router.post('/upgrade-plan', requireRoles('admin'), settingsController.upgradePlan);
router.get('/onboarding-status', settingsController.getOnboardingStatus);
router.post('/logo-upload', requireRoles('admin'), settingsController.uploadLogo);

module.exports = router;
