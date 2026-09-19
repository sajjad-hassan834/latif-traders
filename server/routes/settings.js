const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/', settingsController.getSettings);
router.put('/', requireRoles('admin'), settingsController.updateSettings);
router.get('/db-tables', requireRoles('admin'), settingsController.getDatabaseTables);
router.get('/db-table/:tableName', requireRoles('admin'), settingsController.getTableData);
router.put('/db-table/:tableName/:id', requireRoles('admin'), settingsController.updateTableRow);

module.exports = router;
