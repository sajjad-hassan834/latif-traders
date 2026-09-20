const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireRoles } = require('../middleware/auth');

router.use(authenticate);

// Categories, Units & Brands
router.get('/meta/categories', productController.getCategories);
router.post('/meta/categories', requireRoles('inventory'), productController.createCategory);
router.put('/meta/categories/:id', requireRoles('inventory'), productController.updateCategory);
router.delete('/meta/categories/:id', requireRoles('inventory'), productController.deleteCategory);

router.get('/meta/units', productController.getUnits);
router.post('/meta/units', requireRoles('inventory'), productController.createUnit);
router.put('/meta/units/:id', requireRoles('inventory'), productController.updateUnit);
router.delete('/meta/units/:id', requireRoles('inventory'), productController.deleteUnit);

router.get('/meta/brands', productController.getBrands);
router.post('/meta/brands', requireRoles('inventory'), productController.createBrand);
router.put('/meta/brands/:id', requireRoles('inventory'), productController.updateBrand);
router.delete('/meta/brands/:id', requireRoles('inventory'), productController.deleteBrand);

// Adjustments & Products
router.get('/adjust/history', productController.getAdjustments);
router.post('/adjust', requireRoles('inventory'), productController.adjustStock);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.post('/', requireRoles('inventory'), productController.createProduct);
router.put('/:id', requireRoles('inventory'), productController.updateProduct);
router.delete('/:id', requireRoles('inventory'), productController.deleteProduct);
router.post('/:id/restock', requireRoles('inventory'), productController.restockProduct);

module.exports = router;
