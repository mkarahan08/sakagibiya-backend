// backend/services/passwordResetService.js
//
// Şifre sıfırlama akışının SAF çekirdek fonksiyonları.
//
// Bu dosya iki katmana bölünmüş bir servisin İLK (saf) yarısını içerir:
//   1) Saf yardımcılar: hash, doğrulama, kod expiry, JWT payload/imza
//      → I/O bağımlılığı yok, deterministik, property-test edilebilir (Req 9.2).
//   2) Yüksek seviye orkestrasyon (requestPasswordReset / verifyResetCode /
//      resetPassword) → Task 5.1'de bu dosyaya AYRICA eklenecek; şu an YOK.
//
// Güvenlik gerekçeleri (özet):
//  - bcrypt cost faktörü 10: ŞakaGibiYa repo'sundaki diğer parola hash'leri
//    de cost=10 kullanıyor (userController.js). 2024 standartlarında bu
//    değer makul bir denge sağlar (CPU maliyeti vs. kullanıcı deneyimi).
//    Çok yüksek cost (>=12) request başına ~1sn ekleyerek DoS yüzeyi açar.
//  - Reset JWT'si ana auth token'dan AYRI bir secret (RESET_JWT_SECRET) ile
//    imzalanır. Böylece reset token'ı sızsa bile genel oturum token'ları
//    risk altına girmez ve tersine bir ihlal de password reset akışını
//    bozmaz (defense-in-depth).
//  - JWT payload içinde `purpose: "password_reset"` claim'i bulunur;
//    decode sırasında bu claim doğrulanır. Böylece başka bir akıştan
//    sızmış bir token (örn. login JWT'si yanlışlıkla buraya gönderilirse)
//    kabul edilmez (Req 2.3, 3.3).

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

import User from "../models/users.js";
import PasswordResetCode from "../models/passwordResetCode.js";
import { generateSixDigitCode, sha256Hex } from "../lib/crypto.js";
import { sendPasswordResetEmail } from "./emailService.js";

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

// bcrypt cost faktörü. Repo standardı ile uyumlu (Req 6.4).
const BCRYPT_COST = 10;

// JWT amaç claim'i. Decode sırasında bu eşleşmiyorsa token reddedilir.
const RESET_TOKEN_PURPOSE = "password_reset";

// ---------------------------------------------------------------------------
// Code hashing (bcrypt sarmalayıcılar)
// ---------------------------------------------------------------------------

/**
 * 6 haneli ham reset kodunu bcrypt ile hash'ler.
 *
 * Ham kod ASLA DB'ye yazılmaz; yalnızca hash'i saklanır (Req 6.4).
 * Böylece DB sızıntısında saldırgan kodları doğrudan göremez.
 *
 * @param {string} code 6 haneli ham kod.
 * @returns {Promise<string>} bcrypt hash string'i (60 karakter civarı).
 */
export async function hashCode(code) {
  // bcrypt salt üretimini hash içine gömer; cost=10 ile zaman karmaşıklığı
  // makul aralıkta tutulur (yaklaşık ~70ms/işlem modern donanımda).
  return bcrypt.hash(String(code), BCRYPT_COST);
}

/**
 * Verilen ham kodun, kayıttaki bcrypt hash ile eşleşip eşleşmediğini kontrol eder.
 *
 * `bcrypt.compare` sabit-zamanlı olduğu için yan-kanal (timing) saldırılarına
 * karşı doğal koruma sağlar.
 *
 * @param {string} code Kullanıcının girdiği ham kod.
 * @param {string} hash DB'deki bcrypt hash.
 * @returns {Promise<boolean>} Eşleşiyorsa true, aksi halde false.
 */
export async function verifyCodeHash(code, hash) {
  // bcrypt.compare hash null/undefined geldiğinde patlar; defensive guard.
  if (!hash || typeof hash !== "string") return false;
  return bcrypt.compare(String(code), hash);
}

// ---------------------------------------------------------------------------
// Şifre kalite doğrulaması
// ---------------------------------------------------------------------------

/**
 * Yeni parola için minimum kalite kontrolü.
 *
 * Kurallar (Req 3.5):
 *   - 8 karakterden kısa olamaz.
 *   - Sadece boşluktan oluşamaz (örn. "        " geçersiz). Bu kontrol
 *     8 karakterlik whitespace string'ler için ekstra koruma sağlar;
 *     uzunluk geçse de anlamsız parolaları engeller.
 *
 * Daha karmaşık politikalar (büyük harf/sayı/sembol zorunluluğu) bilinçli
 * olarak EKLENMEDİ; modern öneriler (NIST SP 800-63B) "uzunluk > karmaşıklık"
 * yaklaşımını desteklemektedir. İleride genişletilmek istenirse bu fonksiyon
 * tek nokta olarak güncellenir.
 *
 * @param {string} pwd Aday parola.
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateNewPassword(pwd) {
  // String olmayan girişlere karşı defansif kontrol.
  if (typeof pwd !== "string") {
    return { ok: false, message: "Şifre en az 8 karakter olmalı" };
  }

  if (pwd.length < 8) {
    return { ok: false, message: "Şifre en az 8 karakter olmalı" };
  }

  // Sadece whitespace karakterlerden oluşan parolalar kabul edilmez.
  // (Uzunluk >=8 olsa bile "        " gibi anlamsız değerler engellenir.)
  if (pwd.trim().length === 0) {
    return { ok: false, message: "Şifre sadece boşluktan oluşamaz" };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Süre kontrolü
// ---------------------------------------------------------------------------

/**
 * Verilen `expiresAt` tarihinin, referans `now` zamanına göre geçmiş olup
 * olmadığını döner. Tamamen saf yardımcıdır; içeride `Date.now` çağırmaz,
 * böylece testlerde sabit bir `now` enjekte edilebilir.
 *
 * @param {Date|number|string} expiresAt Kayıttaki son geçerlilik anı.
 * @param {Date} [now=new Date()] Karşılaştırma referans zamanı.
 * @returns {boolean} `now > expiresAt` ise true.
 */
export function isExpired(expiresAt, now = new Date()) {
  // Date olmayan girişler için ms cinsinden numerik karşılaştırma yapılır;
  // böylece string ISO veya epoch ms gibi formatlar da güvenle işlenir.
  const exp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  const ref = now instanceof Date ? now.getTime() : new Date(now).getTime();

  // `Number.isFinite` ile geçersiz tarihleri (NaN) "expired" sayıyoruz;
  // bu güvenli tarafa düşmek (fail-closed) için tercih edilir.
  if (!Number.isFinite(exp)) return true;
  if (!Number.isFinite(ref)) return false;

  return ref > exp;
}

// ---------------------------------------------------------------------------
// JWT payload / imzalama / çözme
// ---------------------------------------------------------------------------

/**
 * Reset token JWT'sinin payload nesnesini üretir.
 *
 * `iat` ve `exp` jsonwebtoken kütüphanesi tarafından `expiresIn` opsiyonu
 * üzerinden otomatik eklenir; bu yüzden bu fonksiyon sadece `sub`, `jti`
 * ve `purpose` claim'lerini hazırlar.
 *
 * @param {string} userId Kullanıcı ObjectId'si (string'e çevrilir).
 * @param {string} jti    Tek-kullanımlık token id (UUID v4 önerilir).
 *                        DB'deki `resetTokenJti` ile aynı olmalı (Req 2.2).
 * @returns {{ sub: string, jti: string, purpose: "password_reset" }}
 */
export function buildResetTokenPayload(userId, jti) {
  return {
    sub: String(userId),
    jti: String(jti),
    purpose: RESET_TOKEN_PURPOSE,
  };
}

/**
 * Reset token'ı imzalar. Ayrı bir secret (`RESET_JWT_SECRET`) ile imzalanması
 * için secret parametre olarak alınır (DI; test ve env esnekliği).
 *
 * @param {string} userId      Kullanıcı id.
 * @param {string} jti         Tek-kullanımlık jti.
 * @param {string} secret      İmzalama secret'ı.
 * @param {number} [ttlMinutes=15] Geçerlilik süresi dakika cinsinden (Req 2.3).
 * @returns {string} İmzalı JWT.
 */
export function signResetToken(userId, jti, secret, ttlMinutes = 15) {
  const payload = buildResetTokenPayload(userId, jti);
  // `expiresIn: "15m"` jsonwebtoken'a `iat` + 15dk olacak şekilde `exp` ekletir.
  return jwt.sign(payload, secret, { expiresIn: `${ttlMinutes}m` });
}

/**
 * Reset token'ı decode eder ve doğrular.
 *
 * - İmza geçersiz / token süresi dolmuş / format bozuk ise `null` döner.
 * - `purpose` claim'i `"password_reset"` değilse de `null` döner; başka bir
 *   akıştan gelen bir JWT (örn. login token'ı) yanlışlıkla burada kabul
 *   edilmesin diye (Req 3.3).
 *
 * Hata fırlatmamasının nedeni: çağıran controller, hatanın türüne göre
 * farklı yanıt vermez; her geçersiz token için aynı 401 mesajı döner.
 * Böylece enumeration-safe bir error model elde edilir.
 *
 * @param {string} token  İstemciden gelen JWT string.
 * @param {string} secret İmzalama secret'ı (signResetToken ile aynı).
 * @returns {{ sub: string, jti: string, purpose: string, exp: number, iat: number } | null}
 */
export function decodeResetToken(token, secret) {
  if (!token || typeof token !== "string") return null;
  try {
    const decoded = jwt.verify(token, secret);
    // `purpose` claim'i sıkı eşitlikle kontrol edilir.
    if (!decoded || decoded.purpose !== RESET_TOKEN_PURPOSE) {
      return null;
    }
    return decoded;
  } catch {
    // İmza/expiry/format hatalarının hepsi aynı şekilde "geçersiz" kabul edilir.
    return null;
  }
}

// ===========================================================================
// I/O katmanı: yüksek seviye orkestrasyon
// ===========================================================================
//
// Aşağıdaki fonksiyonlar User ve PasswordResetCode modelleri ile DB üzerinde
// CRUD yapar; emailService ile e-posta tetikler. Yukarıdaki saf çekirdek
// fonksiyonları (hashCode, verifyCodeHash, validateNewPassword, isExpired,
// signResetToken, decodeResetToken) bu katmanın yapı taşlarıdır.
//
// Loglama sözleşmesi (Req 8.2 - 8.5):
//   - Loglar yapılandırılmış JSON satırları olarak console.log'a yazılır;
//     prod'da bir logger kütüphanesine geçiş kolay olsun.
//   - Hassas alanlar: ham kod, ham parola, JWT raw, JWT payload — KESİNLİKLE
//     loglanmaz. userId yerine sha256(userId) yazılır (Req 8.3).

// ---------------------------------------------------------------------------
// Yardımcılar (private)
// ---------------------------------------------------------------------------

/**
 * Promise tabanlı `setTimeout` sarmalayıcısı.
 * Kayıtsız e-posta yolunda sabit-zaman benzeri davranış için kullanılır,
 * böylece "kayıtlı vs kayıtsız" yanıt süresi farkı enumeration sızıntısı
 * yaratmaz (timing attack azaltma).
 *
 * @param {number} ms Beklenecek milisaniye.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Yapılandırılmış log satırı yazar. Hassas alanlar buraya gönderilmemelidir.
 * @param {Record<string, unknown>} entry
 */
function log(entry) {
  // Tek satır JSON, log toplayıcı sistemler için ideal format.
  try {
    console.log(JSON.stringify({ ts: Date.now(), ...entry }));
  } catch {
    // JSON.stringify circular ref gibi durumlarda sessizce düşsün; logger
    // kritik akışı bozmasın.
  }
}

/**
 * Env değerini integer'a çevirir; geçersizse fallback döndürür.
 * @param {string|undefined} value
 * @param {number} fallback
 */
function envInt(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------------------------------------------------------------------------
// 1) requestPasswordReset — forgot-password orkestrasyonu
// ---------------------------------------------------------------------------

/**
 * Şifre sıfırlama isteğini işler.
 *
 * Akış (Req 1.2, 1.3, 1.8, 1.9):
 *   - User.findOne(email) → bulunamazsa: sabit-zaman jitter delay (timing
 *     enumeration koruması), `reset_no_user` log, sessizce dön.
 *   - Bulunduysa:
 *       a) O kullanıcıya ait önceki tüm aktif kayıtları invalidate et
 *          (consumedAt = now). (Req 1.8)
 *       b) Yeni 6 haneli kod üret + bcrypt hash'le, kayıt oluştur.
 *       c) Email servisini tetikle (hata olursa logla, throw etme — Req 1.9).
 *       d) reset_code_issued log'u yaz.
 *
 * Caller (controller) bu fonksiyondan dönen değere bakmaksızın aynı 200
 * "Eğer bu e-posta sistemde kayıtlıysa kod gönderildi" yanıtını verir;
 * böylece email enumeration sızdırılmaz (Req 1.1, 1.3).
 *
 * @param {{ email: string, ip?: string, now?: Date }} params
 * @returns {Promise<void>}
 */
export async function requestPasswordReset({ email, ip, now = new Date() }) {
  const emailLower = String(email || "").toLowerCase().trim();

  // Kullanıcı modelinde email zaten lowercase saklandığı için doğrudan eşleşir.
  const user = await User.findOne({ email: emailLower });

  if (!user) {
    // Sabit-zaman benzeri jitter (120-180ms) → kayıtsız e-posta yolunun
    // süresi, kayıtlıdan görünür biçimde kısa olmasın (Req 1.3 + threat model).
    await sleep(120 + Math.floor(Math.random() * 60));
    log({ event: "reset_no_user", ip });
    return;
  }

  const userIdHash = sha256Hex(user._id);

  // (a) Aynı kullanıcıya ait önceki tüm aktif kayıtları invalidate et.
  // "Aktif" tanımı: consumedAt == null. expiresAt geçmiş kayıtlar zaten TTL
  // ile silineceği için sorgu bu iki koşulu kapsayacak şekilde tutuluyor.
  try {
    await PasswordResetCode.updateMany(
      { userId: user._id, consumedAt: null },
      { $set: { consumedAt: now } }
    );
  } catch (err) {
    // DB invalidation hatasını log + akışa devam: yeni kod üretmek hâlâ
    // güvenli, çünkü her aktif kayıt kendi attemptsLeft/expiresAt sınırına
    // sahip ve aynı emailLower için bir saldırgan paralel kayıtlardan
    // yararlanamaz (verify her zaman en yeni kaydı sort:-1 ile alır).
    log({ event: "reset_invalidate_failed", userIdHash, error: err?.message });
  }

  // (b) Yeni kod ve hash üretimi.
  const code = generateSixDigitCode();
  const codeHash = await hashCode(code);

  const ttlMinutes = envInt(process.env.PASSWORD_RESET_CODE_TTL_MINUTES, 10);
  const maxAttempts = envInt(process.env.PASSWORD_RESET_MAX_ATTEMPTS, 3);

  await PasswordResetCode.create({
    userId: user._id,
    emailLower: user.email,
    codeHash,
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
    attemptsLeft: maxAttempts,
  });

  // (c) E-posta gönderimi — hata fırlatma, akışı sonlandırma; logla ve devam et.
  try {
    const result = await sendPasswordResetEmail({
      to: user.email,
      code,
      ttlMinutes,
    });
    if (!result?.ok) {
      log({
        event: "email_send_failed",
        userIdHash,
        ip,
        reason: result?.error || "unknown",
      });
    }
  } catch (err) {
    // Email servisi normalde kendi içinde try/catch yapıyor; defansif amaçla
    // yine de yutuyoruz, böylece kullanıcı yanıtına sızıntı olmaz.
    log({
      event: "email_send_failed",
      userIdHash,
      ip,
      message: err?.message,
    });
  }

  // (d) Audit log — ham kod ASLA loglanmaz, yalnızca üretildi bilgisi.
  log({ event: "reset_code_issued", userIdHash, ip });
}

// ---------------------------------------------------------------------------
// 2) verifyResetCode — verify-reset-code orkestrasyonu
// ---------------------------------------------------------------------------

/**
 * Kullanıcının girdiği 6 haneli kodu doğrular.
 *
 * Dönüş:
 *   - { resetToken }                     → başarı
 *   - { error: "INVALID_OR_EXPIRED" }    → eşleşen aktif kayıt yok
 *   - { error: "INVALID_CODE", attemptsLeft } → kod yanlış, deneme azaldı
 *
 * Aktif kayıt tanımı: consumedAt == null AND expiresAt > now AND
 * attemptsLeft > 0. attemptsLeft 0'a düştüğünde kayıt anında invalidate
 * edilir (Req 2.6) ve sonraki çağrılar artık eşleşen aktif kayıt
 * bulamayacağı için sabit "geçersiz/süresi dolmuş" yanıtı alır (Req 2.5).
 *
 * @param {{ email: string, code: string, ip?: string, now?: Date }} params
 * @returns {Promise<{ resetToken: string } | { error: string, attemptsLeft?: number }>}
 */
export async function verifyResetCode({ email, code, ip, now = new Date() }) {
  const emailLower = String(email || "").toLowerCase().trim();

  // En son oluşturulan aktif kaydı al (önceki istekler invalidate edilmiş
  // olsa bile, request anında aktif olan kayıt sadece bir tanedir).
  const record = await PasswordResetCode.findOne({
    emailLower,
    consumedAt: null,
    expiresAt: { $gt: now },
    attemptsLeft: { $gt: 0 },
  }).sort({ createdAt: -1 });

  if (!record) {
    // Kayıt hiç yok ya da süresi dolmuş/tüketilmiş → sabit yanıt (Req 2.5).
    log({ event: "reset_code_inactive", ip });
    return { error: "INVALID_OR_EXPIRED" };
  }

  const userIdHash = sha256Hex(record.userId);

  // bcrypt.compare sabit-zaman karşılaştırma yapar; timing leak yok.
  const ok = await verifyCodeHash(code, record.codeHash);

  if (!ok) {
    // Yanlış kod: attemptsLeft -= 1; 0'a düştüyse kaydı invalidate et.
    record.attemptsLeft = Math.max(0, record.attemptsLeft - 1);
    if (record.attemptsLeft === 0) {
      record.consumedAt = now;
    }
    await record.save();

    log({
      event: "reset_code_failed",
      userIdHash,
      attemptsLeft: record.attemptsLeft,
      ip,
    });

    return { error: "INVALID_CODE", attemptsLeft: record.attemptsLeft };
  }

  // Doğru kod: kaydı tüketildi olarak işaretle ve yeni jti ata.
  const jti = randomUUID();
  record.consumedAt = now;
  record.resetTokenJti = jti;
  await record.save();

  // JWT tokenı imzala. Secret env'den okunur; eksikse jwt.sign hata fırlatır
  // ve controller bunu yakalar (deploy zamanı misconfigurasyon olarak görünür).
  const tokenTtl = envInt(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES, 15);
  const resetToken = signResetToken(
    record.userId.toString(),
    jti,
    process.env.RESET_JWT_SECRET,
    tokenTtl
  );

  log({ event: "reset_code_verified", userIdHash, ip });

  return { resetToken };
}

// ---------------------------------------------------------------------------
// 3) resetPassword — reset-password orkestrasyonu
// ---------------------------------------------------------------------------

/**
 * Reset token + yeni parola ile kullanıcının şifresini değiştirir.
 *
 * Akış:
 *   - decodeResetToken: imza/format/expiry/purpose hatalarında null → INVALID_TOKEN.
 *   - DB'de jti ile aktif kayıt bulunmalı (tokenUsedAt = null) → aksi halde
 *     INVALID_TOKEN (Req 3.4).
 *   - User mevcut olmalı; aksi halde INVALID_TOKEN.
 *   - Yeni parola kalite kontrolü (Req 3.5).
 *   - Yeni parola eski hash ile eşleşiyorsa SAME_PASSWORD (Req 3.6).
 *   - User.password = bcrypt(newPassword, 10); record.tokenUsedAt = now.
 *   - Aynı kullanıcının diğer aktif kayıtlarını da invalidate et (Req 3.8).
 *
 * @param {{ resetToken: string, newPassword: string, ip?: string, now?: Date }} params
 * @returns {Promise<{ ok: true, userId: any } | { error: string, message?: string }>}
 */
export async function resetPassword({
  resetToken,
  newPassword,
  ip,
  now = new Date(),
}) {
  // (1) Token decode + purpose doğrulama.
  const decoded = decodeResetToken(resetToken, process.env.RESET_JWT_SECRET);
  if (!decoded) {
    log({ event: "invalid_reset_token", ip });
    return { error: "INVALID_TOKEN" };
  }

  // (2) DB tarafında jti'li aktif kayıt mevcut mu?
  const record = await PasswordResetCode.findOne({
    resetTokenJti: decoded.jti,
    tokenUsedAt: null,
  });
  if (!record) {
    log({ event: "reused_or_unknown_token", ip });
    return { error: "INVALID_TOKEN" };
  }

  // (3) User var mı?
  const user = await User.findById(decoded.sub);
  if (!user) {
    log({ event: "reset_user_missing", ip });
    return { error: "INVALID_TOKEN" };
  }

  const userIdHash = sha256Hex(user._id);

  // (4) Yeni parola kalite kontrolü (saf fonksiyon).
  const validation = validateNewPassword(newPassword);
  if (!validation.ok) {
    log({ event: "weak_password", userIdHash, ip });
    return { error: "WEAK_PASSWORD", message: validation.message };
  }

  // (5) Yeni parola eski parola ile aynı mı? bcrypt.compare sabit-zaman.
  try {
    const same = await bcrypt.compare(String(newPassword), user.password || "");
    if (same) {
      log({ event: "same_password", userIdHash, ip });
      return { error: "SAME_PASSWORD" };
    }
  } catch {
    // user.password formatı bcrypt değilse compare hata verir; bu durumda
    // güvenli tarafa düş ve "different" kabul et (eski hash zaten geçersiz).
  }

  // (6) Şifreyi güncelle.
  user.password = await bcrypt.hash(String(newPassword), 10);
  await user.save();

  // (7) İlgili reset kaydını tek-kullanımlık yap.
  record.tokenUsedAt = now;
  // Kayıt zaten consumedAt set olduğunda buraya gelmiş olmalı, yine de
  // defansif: eğer henüz set değilse aynı anda kapat.
  if (!record.consumedAt) {
    record.consumedAt = now;
  }
  await record.save();

  // (8) Aynı kullanıcının diğer aktif kayıtlarını da invalidate et (Req 3.8).
  try {
    await PasswordResetCode.updateMany(
      {
        userId: user._id,
        consumedAt: null,
        _id: { $ne: record._id },
      },
      { $set: { consumedAt: now } }
    );
  } catch (err) {
    // Best-effort; kritik değil çünkü ana kayıt zaten kapatıldı.
    log({
      event: "reset_invalidate_others_failed",
      userIdHash,
      error: err?.message,
    });
  }

  log({ event: "password_reset_completed", userIdHash, ip });

  return { ok: true, userId: user._id };
}
