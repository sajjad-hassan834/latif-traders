const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/', requireRoles('accountant'), paymentController.getPayments);
router.post('/customer-receipt', requireRoles('sales', 'accountant'), paymentController.recordCustomerReceipt);
router.post('/supplier-payment', requireRoles('accountant'), paymentController.recordSupplierPayment);
router.get('/cashbook', requireRoles('accountant'), paymentController.getCashbook);
router.delete('/:id', requireRoles('admin', 'accountant'), paymentController.deletePayment);

module.exports = router;
