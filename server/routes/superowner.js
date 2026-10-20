const express = require('express');
const router = express.Router();
const superownerController = require('../controllers/superownerController');
const { authenticate } = require('../middleware/auth');

// Middleware strictly restricting to superowner role
function requireSuperOwner(req, res, next) {
  if (!req.user || req.user.role !== 'superowner') {
    return res.status(403).json({ success: false, message: 'Access denied. SuperOwner privileges required.' });
  }
  next();
}

router.use(authenticate, requireSuperOwner);

router.get('/stats', superownerController.getStats);
router.get('/tenants', superownerController.getTenants);
router.post('/tenants/:id/status', superownerController.updateTenantStatus);
router.post('/tenants/:id/plan', superownerController.updateTenantPlan);
router.delete('/tenants/:id', superownerController.deleteTenant);

module.exports = router;
