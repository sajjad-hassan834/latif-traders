const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

// Categories, Units & Brands
router.get('/meta/categories', productController.getCategories);
router.post('/meta/categories', requireRoles('inventory'), productController.createCategory);
router.get('/meta/units', productController.getUnits);
router.post('/meta/units', requireRoles('inventory'), productController.createUnit);
router.get('/meta/brands', productController.getBrands);
router.post('/meta/brands', requireRoles('inventory'), productController.createBrand);

// Adjustments & Products
router.get('/adjust/history', productController.getAdjustments);
router.post('/adjust', requireRoles('inventory'), productController.adjustStock);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', requireRoles('inventory'), productController.createProduct);
router.put('/:id', requireRoles('inventory'), productController.updateProduct);

module.exports = router;
