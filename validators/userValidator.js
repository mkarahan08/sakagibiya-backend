import { body } from 'express-validator';

export const registerValidator = [
  body('name').trim().notEmpty().withMessage('Ad gerekli').isLength({ min: 2, max: 100 }).withMessage('Ad 2–100 karakter olmalı'),
  body('email').trim().notEmpty().withMessage('Email gerekli').isEmail().withMessage('Geçerli bir email girin').normalizeEmail(),
  body('password').notEmpty().withMessage('Şifre gerekli').isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı'),
  body('gender').optional().trim().isIn(['erkek', 'kadin', 'belirtmek_istemiyorum']).withMessage('Geçerli bir cinsiyet seçin'),
];

export const loginValidator = [
  body('email').trim().notEmpty().withMessage('Email gerekli').isEmail().withMessage('Geçerli bir email girin').normalizeEmail(),
  body('password').notEmpty().withMessage('Şifre gerekli'),
];
