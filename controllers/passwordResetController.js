// backend/controllers/passwordResetController.js
//
// Şifre sıfırlama akışının HTTP controller katmanı.
//
// Sorumluluklar:
//   - express-validator hatalarını 400 Türkçe yanıta map'lemek (Req 1.7, 2.7, 3.5, 3.7).
//   - Servis katmanından gelen { error } kodlarını HTTP statuslarına çevirmek
//     (design.md error tablosu).
//   - Hassas alanları yanıt gövdesine SOKMAMAK (Req 6.6, 8.1).
//   - Beklenmeyen istisnaları yutup, forgot-password yanıtını sabit tutarak
//     email enumeration sızıntısını önlemek (Req 1.1, 1.3, 1.9).
//
// Önemli karar — Req 1.6.1:
//   Rate limit middleware (express-rate-limit) controller'dan ÖNCE çalışır
//   ve doğrudan 429 dönebilir; bu durumda kayıtsız e-posta için de 429
//   sızdırma yapılmış olur. MVP'de bu küçük leak kabul edildi; ileride
//   controller seviyesinde User.findOne sonrası rate limit uygulanarak
//   tamamen elimine edilebilir. Pratikte saldırgan, login endpoint'inden
//   zaten benzer enumeration sinyalleri toplayabilir; bu yüzden tradeoff
//   makul.

import { validationResult } from 'express-validator';
import {
  requestPasswordReset,
  verifyResetCode as verifyResetCodeService,
  resetPassword as resetPasswordService,
} from '../services/passwordResetService.js';

// forgot-password için sabit başarı yanıtı (Req 1.1, 1.3).
// Kayıt durumundan bağımsız aynı gövdeyi döner; enumeration koruması.
const SUCCESS_GENERIC = {
  success: true,
  message: 'Eğer bu e-posta sistemde kayıtlıysa kod gönderildi',
};

/**
 * express-validator çıktısından ilk hatanın Türkçe mesajını döner.
 * @param {import('express-validator').Result} errors
 * @returns {string}
 */
function firstError(errors) {
  const arr = errors.array();
  return arr[0]?.msg || 'Geçersiz istek';
}

/**
 * POST /api/users/forgot-password
 *
 * - Geçersiz e-posta formatı → 400 (Req 1.7).
 * - Servis hatası olsa dahi yanıt sabit 200 + generic mesaj (Req 1.1, 1.3, 1.9).
 *   Hata sunucu logunda tutulur, kullanıcıya sızdırılmaz.
 */
export const forgotPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: firstError(errors) });
  }

  try {
    await requestPasswordReset({ email: req.body.email, ip: req.ip });
  } catch (err) {
    // Beklenmeyen hata: log + sabit success ile devam et (enumeration koruması).
    console.error({
      event: 'forgot_password_unexpected_error',
      message: err?.message,
      ts: Date.now(),
    });
  }

  // Req 1.6.1: Rate limit middleware kayıtsız e-postaya da 429 dönebilir.
  // MVP'de bu küçük leak kabul ediliyor; ileride controller seviyesinde
  // User.findOne sonrası rate limit uygulanarak tamamen elimine edilebilir.
  return res.status(200).json(SUCCESS_GENERIC);
};

/**
 * POST /api/users/verify-reset-code
 *
 * Servis dönüş tipleri:
 *   - { resetToken }                    → 200, success
 *   - { error: 'INVALID_OR_EXPIRED' }   → 400, "Kod geçersiz veya süresi dolmuş" (Req 2.5)
 *   - { error: 'INVALID_CODE', attemptsLeft } → 400, "Kod hatalı" + kalan deneme (Req 2.7)
 */
export const verifyResetCode = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: firstError(errors) });
  }

  try {
    const result = await verifyResetCodeService({
      email: req.body.email,
      code: req.body.code,
      ip: req.ip,
    });

    if (result.error === 'INVALID_OR_EXPIRED') {
      return res.status(400).json({
        success: false,
        message: 'Kod geçersiz veya süresi dolmuş',
      });
    }

    if (result.error === 'INVALID_CODE') {
      return res.status(400).json({
        success: false,
        message: 'Kod hatalı',
        data: { attemptsLeft: result.attemptsLeft },
      });
    }

    // Başarı: sadece resetToken döner. codeHash, jti gibi hassas alanlar
    // yanıt gövdesine asla eklenmez (Req 6.6, 8.1).
    return res.status(200).json({
      success: true,
      data: { resetToken: result.resetToken },
    });
  } catch (err) {
    console.error({
      event: 'verify_reset_code_unexpected_error',
      message: err?.message,
      ts: Date.now(),
    });
    return res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};

/**
 * POST /api/users/reset-password
 *
 * Servis dönüş tipleri:
 *   - { ok: true }                       → 200, "Şifre güncellendi"
 *   - { error: 'INVALID_TOKEN' }         → 401 (Req 3.3, 3.4)
 *   - { error: 'WEAK_PASSWORD', message }→ 400 (Req 3.5)
 *   - { error: 'SAME_PASSWORD' }         → 400 (Req 3.6)
 */
export const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // newPassword < 8 karakter → "Şifre en az 8 karakter olmalı"
    // resetToken eksik       → "Eksik alan"
    return res.status(400).json({ success: false, message: firstError(errors) });
  }

  try {
    const result = await resetPasswordService({
      resetToken: req.body.resetToken,
      newPassword: req.body.newPassword,
      ip: req.ip,
    });

    if (result.error === 'INVALID_TOKEN') {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz veya süresi dolmuş token',
      });
    }

    if (result.error === 'WEAK_PASSWORD') {
      return res.status(400).json({
        success: false,
        message: result.message || 'Şifre en az 8 karakter olmalı',
      });
    }

    if (result.error === 'SAME_PASSWORD') {
      return res.status(400).json({
        success: false,
        message: 'Yeni şifre eski şifrenizle aynı olamaz',
      });
    }

    // Başarı yanıtı: kullanıcı bilgileri veya token yenilemesi yapılmaz;
    // kullanıcı login sayfasına yönlendirilip yeni şifre ile oturum açar.
    return res.status(200).json({ success: true, message: 'Şifre güncellendi' });
  } catch (err) {
    console.error({
      event: 'reset_password_unexpected_error',
      message: err?.message,
      ts: Date.now(),
    });
    return res.status(500).json({ success: false, message: 'Sunucu hatası' });
  }
};
