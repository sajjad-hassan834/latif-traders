const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requireRoles('sales', 'accountant'), saleController.getSales);
router.get('/:id', requireRoles('sales', 'accountant'), saleController.getSaleById);
router.post('/', requireRoles('sales'), saleController.createSale);
router.post('/returns', requireRoles('sales'), saleController.createSaleReturn);
router.post('/bulk-status', requireRoles('sales', 'admin'), saleController.bulkUpdateStatus);
router.patch('/:id/status', requireRoles('sales', 'admin'), saleController.updateOrderStatus);
router.post('/:id/payment', requireRoles('sales', 'accountant'), saleController.recordOrderPayment);
router.put('/:id', requireRoles('admin'), saleController.updateSale);
router.delete('/:id', requireRoles('admin'), saleController.deleteSale);

module.exports = router;
