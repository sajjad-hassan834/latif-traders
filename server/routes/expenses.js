const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenantContext');

router.use(authenticate);
router.use(tenantContext);

router.get('/', requireRoles('accountant'), expenseController.getExpenses);
router.post('/', requireRoles('accountant'), expenseController.createExpense);
router.put('/:id', requireRoles('accountant'), expenseController.updateExpense);
router.delete('/:id', requireRoles('admin'), expenseController.deleteExpense);
router.get('/categories', expenseController.getCategories);
router.post('/categories', requireRoles('admin'), expenseController.createCategory);

module.exports = router;
