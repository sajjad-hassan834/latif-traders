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
router.post('/tenants/:id/archive', superownerController.archiveTenant);
router.post('/tenants/:id/restore', superownerController.restoreTenant);
router.delete('/tenants/:id', superownerController.deleteTenant);

// Governed Impersonation
router.post('/impersonate/start', superownerController.startImpersonation);
router.post('/impersonate/end', superownerController.endImpersonation);

// Support Operations Desk
router.post('/support/reset-link', superownerController.generateResetLink);
router.post('/support/force-logout', superownerController.forceLogout);

// Full system database backup and recovery (SuperOwner only)
router.post('/backup/create', superownerController.createFullDatabaseBackup);
router.get('/backup', superownerController.listFullDatabaseBackups);
router.get('/backup/download/:filename', superownerController.downloadFullDatabaseBackup);
router.post('/backup/restore', superownerController.restoreFullDatabaseBackup);

module.exports = router;

