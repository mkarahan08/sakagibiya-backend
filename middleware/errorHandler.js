/**
 * Merkezi hata işleyici.
 * Production'da istemciye detaylı hata mesajı gönderilmez.
 */
const errorHandler = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Mongoose validation hatası → 400
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(e => e.message).join(', ');
    return res.status(400).json({ success: false, message: message || 'Geçersiz veri' });
  }

  // Mongoose CastError (geçersiz ObjectId vb.) → 400
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Geçersiz ID' });
  }

  // JWT hataları → 401
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Geçersiz veya süresi dolmuş token' });
  }

  const status = err.statusCode || err.status || 500;
  const message = status >= 500 && isProduction
    ? 'Sunucu hatası'
    : (err.message || 'Sunucu hatası');

  res.status(status).json({ success: false, message });
};

export default errorHandler;
