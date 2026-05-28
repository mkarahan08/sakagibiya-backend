/**
 * Cache-Control: no-store middleware (Req 8.6).
 *
 * Şifre sıfırlama uç noktalarının yanıtlarının (özellikle resetToken
 * içeren verify-reset-code yanıtının) hiçbir ara katman veya tarayıcı
 * cache'inde tutulmamasını garanti eder.
 */
export function noStoreCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  next();
}

export default noStoreCache;
