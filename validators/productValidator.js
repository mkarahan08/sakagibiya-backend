import { body, query, param } from 'express-validator';

const allowedProductFields = ['id', 'name', 'brand', 'original_price', 'final_price', 'image', 'url', 'category', 'satici', 'discount', 'is_active', 'last_updated'];

export const createProductValidator = [
  body('name').trim().notEmpty().withMessage('Ürün adı gerekli').isLength({ max: 500 }).withMessage('Ürün adı çok uzun'),
  body('brand').trim().notEmpty().withMessage('Marka gerekli').isLength({ max: 200 }).withMessage('Marka çok uzun'),
  body('original_price').trim().notEmpty().withMessage('Orijinal fiyat gerekli'),
  body('image').trim().notEmpty().withMessage('Görsel URL gerekli').isURL().withMessage('Geçerli görsel URL girin'),
  body('url').trim().notEmpty().withMessage('Ürün URL gerekli').isURL().withMessage('Geçerli URL girin'),
  body('category').trim().notEmpty().withMessage('Kategori gerekli').isLength({ max: 200 }).withMessage('Kategori çok uzun'),
  body('satici').trim().notEmpty().withMessage('Satıcı gerekli').isLength({ max: 200 }).withMessage('Satıcı çok uzun'),
  body('final_price').optional().trim(),
];

export const updateProductValidator = [
  param('id').isMongoId().withMessage('Geçersiz ürün ID'),
  body('name').optional().trim().isLength({ max: 500 }).withMessage('Ürün adı çok uzun'),
  body('brand').optional().trim().isLength({ max: 200 }).withMessage('Marka çok uzun'),
  body('image').optional().trim().isURL().withMessage('Geçerli görsel URL girin'),
  body('url').optional().trim().isURL().withMessage('Geçerli URL girin'),
  body('category').optional().trim().isLength({ max: 200 }),
  body('satici').optional().trim().isLength({ max: 200 }),
  body('original_price').optional().trim(),
  body('final_price').optional().trim(),
];

export const listProductsValidator = [
  query('page').optional().isInt({ min: 1 }).withMessage('Sayfa 1 veya daha büyük olmalı').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit 1–100 arası olmalı').toInt(),
  query('category').optional().trim().isLength({ max: 200 }),
];

export const searchProductsValidator = [
  query('query').trim().notEmpty().withMessage('Arama terimi gerekli').isLength({ max: 200 }).withMessage('Arama terimi çok uzun'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
];

export const productIdParamValidator = [
  param('id').isMongoId().withMessage('Geçersiz ürün ID'),
];

export function getAllowedProductFields() {
  return allowedProductFields;
}
