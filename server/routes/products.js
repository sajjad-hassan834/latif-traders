const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

// Products
router.get('/', productController.getProducts);
router.get('/adjust/history', productController.getAdjustments);
router.get('/:id', productController.getProductById);
router.post('/', requireRoles('inventory'), productController.createProduct);
router.put('/:id', requireRoles('inventory'), productController.updateProduct);

// Adjustments
router.post('/adjust', requireRoles('inventory'), productController.adjustStock);

// Categories & Units
router.get('/meta/categories', productController.getCategories);
router.post('/meta/categories', requireRoles('inventory'), productController.createCategory);
router.get('/meta/units', productController.getUnits);
router.post('/meta/units', requireRoles('inventory'), productController.createUnit);

module.exports = router;
