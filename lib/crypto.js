// backend/lib/crypto.js
//
// Şifre sıfırlama akışında kullanılan kriptografik yardımcılar.
// Hepsi I/O bağımlılığı taşımayan SAF fonksiyonlardır; bu sayede
// property-based test edilmeleri kolaydır (Req 9.2).
//
// Güvenlik notu:
//  - 6 haneli kod, kullanıcı dostu olsun diye sayısaldır; ancak brute-force'a
//    karşı `attemptsLeft=3` ve rate limit ile sınırlandırıldığı için
//    1.000.000 kombinasyon yeterince güvenli kabul edilir (Req 6.5).
//  - Kod üretimi MUTLAKA kriptografik güvenli kaynaktan gelmelidir;
//    bu yüzden Node'un built-in `crypto.randomInt` API'si kullanılır.
//    `Math.random` predictable olduğu için ASLA tercih edilmez.

import crypto, { randomInt } from "node:crypto";

/**
 * 6 haneli sıfır dolgulu sayısal kod üretir.
 *
 * Çıktı her zaman `/^\d{6}$/` formatında 6 karakterlik string'tir
 * (örn. `"000042"`, `"999999"`).
 *
 * @param {(min: number, max: number) => number} [rng=randomInt]
 *        Test edilebilirlik (DI) için override edilebilen rastgele üretici.
 *        Varsayılan olarak Node'un kriptografik güvenli `crypto.randomInt`'i
 *        kullanılır.
 * @returns {string} 6 haneli kod, sıfırla pad'lenmiş.
 */
export function generateSixDigitCode(rng = randomInt) {
  // randomInt(0, 1_000_000) -> [0, 999999] aralığında uniform dağılım.
  // Üst sınır exclusive olduğu için 1_000_000 değil 999_999 gelir.
  const n = rng(0, 1_000_000);
  // 6 hane sıfırla doldurulur ki kod hep aynı uzunlukta olsun
  // (UI'da OTP input'larının stabil dolması için kritik).
  return String(n).padStart(6, "0");
}

/**
 * Verilen string için SHA-256 hex digest üretir.
 *
 * Loglarda `userId`'yi düz olarak yazmak yerine bu fonksiyondan geçirilen
 * pseudonymized hash kullanılır (Req 8.3). Böylece log dump'larından
 * kullanıcı kimliği doğrudan tespit edilemez.
 *
 * Not: Bu fonksiyon bir "şifreleme" değildir; deterministiktir ve
 * salt taşımaz. Sadece pseudonymization amaçlıdır.
 *
 * @param {string} input Hash'lenecek girdi (genellikle userId string).
 * @returns {string} 64 karakterlik hex string.
 */
export function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}
