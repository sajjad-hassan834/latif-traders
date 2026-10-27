const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenantContext');

router.use(authenticate);
router.use(tenantContext);

router.get('/', requireRoles('inventory', 'accountant'), purchaseController.getPurchases);
router.get('/suppliers/:supplierId/products', requireRoles('inventory', 'accountant'), purchaseController.getSupplierProducts);
router.get('/product-stock-preview/:productId', requireRoles('inventory', 'accountant'), purchaseController.getProductStockPreview);
router.get('/:id', requireRoles('inventory', 'accountant'), purchaseController.getPurchaseById);
router.post('/', requireRoles('inventory'), purchaseController.createPurchase);
router.post('/returns', requireRoles('inventory'), purchaseController.createPurchaseReturn);
router.put('/:id', requireRoles('admin'), purchaseController.updatePurchase);
router.delete('/:id', requireRoles('admin'), purchaseController.deletePurchase);

module.exports = router;
