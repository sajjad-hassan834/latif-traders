const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requireRoles('sales', 'accountant'), saleController.getSales);
router.get('/:id', requireRoles('sales', 'accountant'), saleController.getSaleById);
router.post('/', requireRoles('sales'), saleController.createSale);
router.post('/returns', requireRoles('sales'), saleController.createSaleReturn);
router.delete('/:id', requireRoles('admin'), saleController.deleteSale);

module.exports = router;
