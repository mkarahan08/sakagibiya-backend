import productRoutes from './routes/product.route.js'
import userRoutes from "./routes/user.route.js"
import favoriteRoutes from "./routes/favorite.route.js"
import dotenv from 'dotenv';
import express from 'express'
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import errorHandler from './middleware/errorHandler.js';

dotenv.config();

// Ortam değişkenleri zorunluluğu (fail-fast)
if (!process.env.JWT_SECRET) {
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  process.exit(1);
}

const app = express();

// ✅ CORS: diğer middleware'lerden ve route'lardan ÖNCE tanımlanmalı
const allowedOrigins = [
  'https://www.sakagibiya.com',
  'https://sakagibiya.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,        // Vercel URL: https://sakagibiya.vercel.app
].filter(Boolean); // undefined olanları çıkar

app.use(
  cors({
    origin: (origin, callback) => {
      // Production'da origin zorunlu
      if (process.env.NODE_ENV === 'production' && !origin) {
        return callback(new Error('CORS: Origin gerekli'), false);
      }
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: ${origin} adresine izin verilmiyor.`), false);
    },
    credentials: true,
  })
);

// ✅ Preflight (OPTIONS) istekleri için — Express 5 uyumlu regex
app.options(/(.*)/, cors());

// Güvenlik başlıkları
app.use(helmet());

// Rate limiting: genel API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100,
  message: { success: false, message: 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Rate limiting: auth (login/register) — daha sıkı
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);

// İstek gövdesi limiti (DoS önleme)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// HTTP istek logu
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Sunucu sağlık kontrolü (DB durumu dahil)
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbConnected = dbState === 1;
  if (dbConnected) {
    res.status(200).json({ status: 'ok', db: 'connected' });
  } else {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

//routes
app.use('/api/products', productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);

app.get('/', (req, res) => {
    res.send('Hello World API Server');
});

// 404
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Sayfa bulunamadı' });
});

// Merkezi hata işleyici (en sonda)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0');
  })
  .catch(() => {
    process.exit(1);
  });

