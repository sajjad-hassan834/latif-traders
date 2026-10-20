const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, requireRoles } = require('../middleware/auth');

// Public settings route (extracts branding if token present or returns platform defaults)
router.get('/', (req, res, next) => {
  // If authorization header provided, authenticate to get tenant settings
  if (req.headers.authorization || (req.cookies && req.cookies.token)) {
    return authenticate(req, res, () => settingsController.getSettings(req, res));
  }
  return settingsController.getSettings(req, res);
});

// Protected settings and billing management
router.use(authenticate);
router.put('/', requireRoles('admin'), settingsController.updateSettings);
router.post('/', requireRoles('admin'), settingsController.updateSettings);
router.get('/billing', settingsController.getBillingInfo);
router.post('/upgrade-plan', requireRoles('admin'), settingsController.upgradePlan);

module.exports = router;
