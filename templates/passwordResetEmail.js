// Şifre sıfırlama e-postası şablonu.
// HTML ve plain-text içeriği template literal ile üretilir; placeholder replace
// gerekmez çünkü değerler doğrudan literal'e enjekte edilir.
//
// Güvenlik notu (Req 4.6): Kod, kopyalanabilirliği artırmak için monospaced font
// ile büyük puntoda gösterilir. Süre ve "siz yapmadıysanız" uyarısı (Req 4.2)
// gövdede yer alır. Konu satırı sabittir (Req 4.1).

/**
 * Şifre sıfırlama e-postasının subject/html/text alanlarını üretir.
 *
 * @param {{ code: string, ttlMinutes: number }} params
 *   - code: 6 haneli ham doğrulama kodu (DB'ye yazılan codeHash değil)
 *   - ttlMinutes: kodun geçerlilik süresi (dakika cinsinden, ör. 10)
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderPasswordResetEmail({ code, ttlMinutes }) {
  // Konu satırı: Req 4.1 — Türkçe ve sabit.
  const subject = "ŞakaGibiYa - Şifre Sıfırlama Kodu";

  // HTML gövde: kod büyük ve monospaced; uyarı metni dahil (Req 4.2, 4.6).
  const html = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:24px;background-color:#f6f6f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;">
    <div style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <h2 style="margin:0 0 16px 0;color:#111;">ŞakaGibiYa - Şifre Sıfırlama</h2>
      <p style="margin:0 0 12px 0;line-height:1.5;">Merhaba,</p>
      <p style="margin:0 0 20px 0;line-height:1.5;">
        Hesabın için bir şifre sıfırlama isteği aldık. Aşağıdaki 6 haneli kodu
        uygulamada ilgili alana girerek şifreni yenileyebilirsin:
      </p>
      <p style="margin:24px 0;text-align:center;">
        <span style="display:inline-block;padding:16px 24px;background-color:#f0f0f0;border:1px solid #ddd;border-radius:6px;font-family:'Courier New',Consolas,Monaco,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#111;">${code}</span>
      </p>
      <p style="margin:0 0 12px 0;line-height:1.5;">
        Bu kod <b>${ttlMinutes} dakika</b> boyunca geçerlidir. En fazla 3 yanlış
        denemeden sonra geçersiz hale gelir.
      </p>
      <p style="margin:0 0 12px 0;line-height:1.5;color:#a94442;">
        Bu isteği <b>siz yapmadıysanız</b> bu e-postayı dikkate almayın ve
        şifrenizi değiştirmeyin. Hesabınız güvende kalır.
      </p>
      <p style="margin:24px 0 0 0;line-height:1.5;color:#666;font-size:13px;">
        — ŞakaGibiYa Ekibi
      </p>
    </div>
  </body>
</html>`;

  // Plain-text karşılığı (Req 4.3): HTML'i destekleyemeyen istemciler için.
  const text = `ŞakaGibiYa - Şifre Sıfırlama

Merhaba,

Hesabın için bir şifre sıfırlama isteği aldık. Aşağıdaki 6 haneli kodu uygulamada ilgili alana girerek şifreni yenileyebilirsin:

    ${code}

Bu kod ${ttlMinutes} dakika boyunca geçerlidir. En fazla 3 yanlış denemeden sonra geçersiz hale gelir.

Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın ve şifrenizi değiştirmeyin. Hesabınız güvende kalır.

— ŞakaGibiYa Ekibi
`;

  return { subject, html, text };
}
