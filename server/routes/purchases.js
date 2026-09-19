const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requireRoles('inventory', 'accountant'), purchaseController.getPurchases);
router.get('/product-stock-preview/:productId', requireRoles('inventory', 'accountant'), purchaseController.getProductStockPreview);
router.get('/:id', requireRoles('inventory', 'accountant'), purchaseController.getPurchaseById);
router.post('/', requireRoles('inventory'), purchaseController.createPurchase);
router.post('/returns', requireRoles('inventory'), purchaseController.createPurchaseReturn);

module.exports = router;
