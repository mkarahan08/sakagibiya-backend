import express from 'express'
import Product from '../models/products.js'
const router = express.Router();
import {getAllProducts, getProductById,createProduct,updateProduct , deleteProduct, searchProducts, getSimilarProducts} from '../controllers/productController.js'

router.get('/search', searchProducts); // 🔍 Arama route'u (/:id'den önce olmalı)
// GET /platform-sellers → app.js (/:id ile çakışmaması için mount’tan önce)
router.get('/:id/similar', getSimilarProducts); // Benzer urunler — /:id'den ÖNCE olmalı
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/',createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
