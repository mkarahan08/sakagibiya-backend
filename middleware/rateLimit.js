import rateLimit from 'express-rate-limit';

/**
 * Şifre sıfırlama akışı için rate limit middleware'leri.
 *
 * - forgot-password: 3/15dk per email + 10/saat per IP (Req 1.5, 1.6)
 * - verify-reset-code: 5/15dk per email + 30/saat per IP (Req 2.8)
 * - reset-password: 5/15dk per IP
 *
 * Not: Req 1.6.1 — kayıtsız e-posta için rate limit yerine sabit 200 yanıt
 * dönmesi gerekir; bu davranış controller katmanında handle edilir.
 *
 * Test ortamında bypass: RATE_LIMIT_DISABLED=true env'i ile tüm limiter'lar
 * skip edilir (jest+supertest çalışırken rate limit'in testleri kirletmesini
 * engellemek için).
 */

// Test ortamında rate limit'i devre dışı bırakma bayrağı.
// Her istek başında env değerini okur (testlerde dinamik değişime izin verir).
const RATE_LIMIT_DISABLED = () => process.env.RATE_LIMIT_DISABLED === 'true';

// Tüm limiter'ların ortak yanıtı (Türkçe, sabit mesaj).
const SHARED_RESPONSE = {
  success: false,
  message: 'Çok fazla deneme yaptınız, lütfen daha sonra tekrar deneyin',
};

// Ortak konfigürasyon yardımcısı: standart header'lar açık, legacy kapalı,
// sabit Türkçe mesaj ve test ortamı bypass'ı her limiter'a uygulanır.
const baseConfig = (overrides) => ({
  standardHeaders: true,
  legacyHeaders: false,
  message: SHARED_RESPONSE,
  skip: () => RATE_LIMIT_DISABLED(),
  ...overrides,
});

// forgot-password: e-posta başına 15 dakikada 3 istek.
// Anahtar küçük harfe indirgenip trim edilir; böylece "User@x.com" ile
// "user@x.com" aynı kovaya düşer.
export const forgotPasswordEmailLimiter = rateLimit(baseConfig({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `email:${(req.body?.email || '').toLowerCase().trim()}`,
}));

// forgot-password: IP başına saatte 10 istek.
// IP rotasyonu olmaksızın brute-force taramasını yavaşlatır.
export const forgotPasswordIpLimiter = rateLimit(baseConfig({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `ip:${req.ip}`,
}));

// verify-reset-code: e-posta başına 15 dakikada 5 istek.
// attemptsLeft (3) ile birlikte iki katmanlı koruma sağlar.
export const verifyCodeEmailLimiter = rateLimit(baseConfig({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `email:${(req.body?.email || '').toLowerCase().trim()}`,
}));

// verify-reset-code: IP başına saatte 30 istek.
export const verifyCodeIpLimiter = rateLimit(baseConfig({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => `ip:${req.ip}`,
}));

// reset-password: IP başına 15 dakikada 5 istek.
// Token tek-kullanımlık olsa da rastgele token sondalamasını sınırlar.
export const resetPasswordIpLimiter = rateLimit(baseConfig({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `ip:${req.ip}`,
}));
