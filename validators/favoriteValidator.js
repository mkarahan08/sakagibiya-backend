import { body, param } from 'express-validator';

export const addFavoriteValidator = [
  body('productId').notEmpty().withMessage("Ürün ID gerekli").isMongoId().withMessage('Geçersiz ürün ID'),
];

export const productIdParamValidator = [
  param('productId').isMongoId().withMessage('Geçersiz ürün ID'),
];

export const toggleFavoriteValidator = [
  body('productId').notEmpty().withMessage("Ürün ID gerekli").isMongoId().withMessage('Geçersiz ürün ID'),
];
