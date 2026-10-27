const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenantContext');

router.use(authenticate);
router.use(tenantContext);

// Admin-only user management and audit trails
router.get('/', requireRoles('admin'), userController.getUsers);
router.post('/', requireRoles('admin'), userController.createUser);
router.put('/:id', requireRoles('admin'), userController.updateUser);
router.delete('/:id', requireRoles('admin'), userController.deleteUser);
router.get('/audit-logs', requireRoles('admin'), userController.getAuditLogs);
router.get('/reset-requests', requireRoles('admin'), userController.getPasswordResetRequests);
router.post('/reset-requests/:id/resolve', requireRoles('admin'), userController.resolvePasswordResetRequest);

module.exports = router;
