const express = require('express');
const router = express.Router();
const partyController = require('../controllers/partyController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

// Customers
router.get('/customers', partyController.getCustomers);
router.post('/customers', requireRoles('sales', 'accountant'), partyController.createCustomer);
router.put('/customers/:id', requireRoles('sales', 'accountant'), partyController.updateCustomer);
router.delete('/customers/:id', requireRoles('admin'), partyController.deleteCustomer);
router.get('/customers/:id/ledger', partyController.getCustomerLedger);

// Suppliers
router.get('/suppliers', requireRoles('inventory', 'accountant'), partyController.getSuppliers);
router.post('/suppliers', requireRoles('inventory', 'accountant'), partyController.createSupplier);
router.put('/suppliers/:id', requireRoles('inventory', 'accountant'), partyController.updateSupplier);
router.delete('/suppliers/:id', requireRoles('admin'), partyController.deleteSupplier);
router.get('/suppliers/:id/ledger', requireRoles('inventory', 'accountant'), partyController.getSupplierLedger);
router.post('/suppliers/recalculate-balances', requireRoles('admin'), partyController.recalculateSupplierBalances);

module.exports = router;
