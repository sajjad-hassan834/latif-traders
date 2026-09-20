const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, requireRoles } = require('../middleware/auth');

// Publicly accessible settings (shop name, tagline, address, phone for branding & invoice headers)
router.get('/', settingsController.getSettings);

// Protected admin settings and database explorer
router.use(authenticate);
router.put('/', requireRoles('admin'), settingsController.updateSettings);
router.get('/db-tables', requireRoles('admin'), settingsController.getDatabaseTables);
router.get('/db-table/:tableName', requireRoles('admin'), settingsController.getTableData);
router.put('/db-table/:tableName/:id', requireRoles('admin'), settingsController.updateTableRow);
router.post('/wipe-data-delivery', requireRoles('admin'), settingsController.wipeDataForDelivery);

module.exports = router;
