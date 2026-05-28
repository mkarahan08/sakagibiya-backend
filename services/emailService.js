// Email servisi: Resend SDK sarmalayıcısı + test/dev için bellek-içi mock transport.
//
// Transport seçimi (Req 4.5, 7.3):
//   - process.env.NODE_ENV === "test"   → her zaman "mock" (testlerde gerçek
//     e-posta gönderimi olmaz; aksi halde Resend'e ücretli istek gider).
//   - EMAIL_TRANSPORT === "mock"        → bellek-içi kuyruğa yaz.
//   - EMAIL_TRANSPORT === "resend"      → gerçek Resend API çağrısı.
//
// Enumeration koruması (Req 1.9 + 4.4):
//   - Resend API hata fırlatırsa veya env eksikse exception fırlatmıyoruz.
//   - Bunun yerine { ok: false, error } döndürüp caller (passwordResetService)
//     loglayıp kullanıcıya yine başarı yanıtı vermeye devam eder. Aksi halde
//     "kayıtlı kullanıcıda hata, kayıtsızda başarı" farkı enumeration sızıntısı
//     yaratır.

import { Resend } from "resend";
import { renderPasswordResetEmail } from "../templates/passwordResetEmail.js";

// Test/dev için bellek-içi gönderim kuyruğu. Sadece mock transport'ta dolar.
const __sentEmails = [];

/**
 * Aktif transport tipini döndürür.
 * Test ortamında her zaman "mock" zorlanır.
 * @returns {"mock" | "resend"}
 */
const transport = () => {
  if (process.env.NODE_ENV === "test") return "mock";
  const t = (process.env.EMAIL_TRANSPORT || "resend").toLowerCase();
  return t === "mock" ? "mock" : "resend";
};

/**
 * Şifre sıfırlama e-postasını gönderir.
 *
 * @param {{ to: string, code: string, ttlMinutes: number }} params
 * @returns {Promise<{ ok: true, id: string } | { ok: false, error: string }>}
 *   Hata fırlatmaz; caller'a serileşmiş sonuç döner (Req 1.9).
 */
export async function sendPasswordResetEmail({ to, code, ttlMinutes }) {
  const { subject, html, text } = renderPasswordResetEmail({ code, ttlMinutes });
  const from = process.env.RESEND_FROM_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;

  // Mock transport: bellek-içi kuyruğa yaz, gerçek SDK çağırma.
  if (transport() === "mock") {
    __sentEmails.push({
      to,
      from: from || "mock@local",
      subject,
      html,
      text,
      sentAt: new Date(),
    });
    return { ok: true, id: "mock-" + Date.now() };
  }

  // Real Resend transport: env eksikse hata loglat, throw etme (Req 4.4).
  if (!apiKey || !from) {
    console.error({
      event: "email_misconfigured",
      reason: "missing_resend_env",
      ts: Date.now(),
    });
    return { ok: false, error: "RESEND_NOT_CONFIGURED" };
  }

  try {
    const client = new Resend(apiKey);
    const result = await client.emails.send({ from, to, subject, html, text });
    return { ok: true, id: result?.data?.id };
  } catch (err) {
    // Resend hatası kullanıcı yanıtına sızdırılmaz; sunucuda log + ok:false.
    console.error({
      event: "email_send_failed",
      message: err?.message,
      ts: Date.now(),
    });
    return { ok: false, error: "EMAIL_SEND_FAILED" };
  }
}

// Test yardımcıları — yalnızca mock transport'ta anlamlıdır.

/** Mock kuyruktaki tüm gönderilmiş e-postaların kopyasını döndürür. */
export function __getSentEmails() {
  return [...__sentEmails];
}

/** Mock kuyruğu temizler (her test öncesi çağrılır). */
export function __clearSentEmails() {
  __sentEmails.length = 0;
}
