const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/', settingsController.getSettings);
router.put('/', requireRoles('admin'), settingsController.updateSettings);

module.exports = router;
