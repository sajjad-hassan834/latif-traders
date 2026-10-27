const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenantContext');

router.use(authenticate);
router.use(tenantContext);

// Admin-only backup & restore operations
router.post('/create', requireRoles('admin'), backupController.createBackup);
router.get('/', requireRoles('admin'), backupController.listBackups);
router.get('/download/:filename', requireRoles('admin'), backupController.downloadBackup);
router.post('/restore', requireRoles('admin'), backupController.restoreBackup);

module.exports = router;
