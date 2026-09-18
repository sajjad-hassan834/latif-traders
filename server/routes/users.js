const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

// Admin-only user management and audit trails
router.get('/', requireRoles('admin'), userController.getUsers);
router.post('/', requireRoles('admin'), userController.createUser);
router.put('/:id', requireRoles('admin'), userController.updateUser);
router.get('/audit-logs', requireRoles('admin'), userController.getAuditLogs);

module.exports = router;
