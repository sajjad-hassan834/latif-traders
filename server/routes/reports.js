const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard', reportController.getDashboardMetrics);
router.get('/profit-loss', requireRoles('accountant'), reportController.getProfitAndLoss);
router.get('/daily-sales', requireRoles('sales', 'accountant'), reportController.getDailySalesReport);
router.get('/stock', reportController.getStockReport);
router.get('/expiry', reportController.getExpiryReport);
router.get('/purchases', requireRoles('inventory', 'accountant'), reportController.getPurchasesReport);
router.get('/product-sales', requireRoles('sales', 'accountant'), reportController.getProductSalesReport);
router.get('/movements', requireRoles('inventory', 'accountant'), reportController.getStockMovementsReport);
router.get('/day-register', requireRoles('sales', 'accountant'), reportController.getDayRegister);

module.exports = router;
