import express from 'express'
const router = express.Router();
import { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, searchProducts } from '../controllers/productController.js'
import { protect } from '../middleware/authMiddleware.js'
import { validate } from '../middleware/validate.js'
import { createProductValidator, updateProductValidator, searchProductsValidator, productIdParamValidator } from '../validators/productValidator.js'

router.get('/search', searchProductsValidator, validate, searchProducts);
router.get('/', getAllProducts);
router.get('/:id', productIdParamValidator, validate, getProductById);
router.post('/', protect, createProductValidator, validate, createProduct);
router.put('/:id', protect, updateProductValidator, validate, updateProduct);
router.delete('/:id', protect, productIdParamValidator, validate, deleteProduct);

export default router;
