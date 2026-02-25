import express from 'express'
import Product from '../models/hepsiburada.js'
const router = express.Router();
import {getAllProducts, getProductById,createProduct,updateProduct , deleteProduct, searchProducts} from '../controllers/productController.js'

router.get('/search', searchProducts); // 🔍 Arama route'u (/:id'den önce olmalı)
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/',createProduct);
router.put('/:id', updateProduct);
router.delete('/:id',deleteProduct);

export default router;
