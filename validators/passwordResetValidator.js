import { body } from 'express-validator';

/**
 * Şifre sıfırlama akışı için express-validator zincirleri.
 *
 * - forgotPasswordValidator: e-posta adresinin RFC 5322 formatına uygun olduğunu doğrular
 *   ve normalleştirir (Req 1.7).
 * - verifyResetCodeValidator: e-posta + 6 haneli sayısal kod kontrolü (Req 2.7).
 * - resetPasswordValidator: resetToken ve newPassword (min 8 karakter) doğrulaması
 *   (Req 3.5, 3.7).
 *
 * Hata mesajları Türkçe; mesaj metni requirements.md'deki sabitlerle birebir eşleşir.
 */

// 1) Forgot password: yalnızca e-posta alanı doğrulanır.
//    normalizeEmail küçük harfe indirir ve fazlalıkları temizler — böylece
//    rate limit anahtarı (email) tutarlı olur.
export const forgotPasswordValidator = [
  body('email')
    .isEmail().withMessage('Geçerli bir email girin')
    .normalizeEmail(),
];

// 2) Verify reset code: e-posta + 6 haneli kod.
//    Kod kesinlikle 6 rakamdan oluşmalı (örn. "012345" gibi sıfır dolgulu).
export const verifyResetCodeValidator = [
  body('email')
    .isEmail().withMessage('Geçerli bir email girin')
    .normalizeEmail(),
  body('code')
    .isString().withMessage('Kod 6 haneli olmalı')
    .matches(/^\d{6}$/).withMessage('Kod 6 haneli olmalı'),
];

// 3) Reset password: resetToken (string, boş değil) + newPassword (>= 8 karakter).
//    Şifre kalite kontrolünün ek kısımları (eski ile aynı olmama vs.) servis
//    katmanında yapılır; burada yalnızca minimum uzunluk doğrulanır.
export const resetPasswordValidator = [
  body('resetToken')
    .isString().withMessage('Eksik alan')
    .notEmpty().withMessage('Eksik alan'),
  body('newPassword')
    .isString().withMessage('Şifre en az 8 karakter olmalı')
    .isLength({ min: 8 }).withMessage('Şifre en az 8 karakter olmalı'),
];
