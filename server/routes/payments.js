const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenantContext');

router.use(authenticate);
router.use(tenantContext);

// Shift / Cash Drawer Management
router.get('/shifts/current', paymentController.getCurrentShift);
router.get('/shift/current', paymentController.getCurrentShift);
router.post('/shifts/open', paymentController.openShift);
router.post('/shift/open', paymentController.openShift);
router.post('/shifts/close', paymentController.closeShiftBlind);
router.post('/shift/close', paymentController.closeShiftBlind);
router.get('/shifts', paymentController.getShifts);

router.get('/', requireRoles('accountant'), paymentController.getPayments);
router.post('/customer-receipt', requireRoles('sales', 'accountant'), paymentController.recordCustomerReceipt);
router.post('/supplier-payment', requireRoles('accountant'), paymentController.recordSupplierPayment);
router.get('/cashbook', requireRoles('accountant'), paymentController.getCashbook);
router.delete('/:id', requireRoles('admin', 'accountant'), paymentController.deletePayment);

module.exports = router;
