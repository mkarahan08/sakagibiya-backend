import productRoutes from './routes/product.route.js'
import userRoutes from "./routes/user.route.js"
import favoriteRoutes from "./routes/favorite.route.js"
import dotenv from 'dotenv';
import express from 'express'
import mongoose from 'mongoose'
import connectDB from './config/db.js';
import cors from 'cors';
dotenv.config();
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
      // Postman/curl gibi Origin göndermeyenlere izin ver
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      return callback(new Error(`CORS: ${origin} adresine izin verilmiyor.`));
    },
    credentials: true,
  })
);

// ✅ Preflight (OPTIONS) istekleri için
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Sunucu sağlık kontrolü endpoint'i
app.get('/health', (req, res) => res.status(200).send('ok'));

//routes
app.use('/api/products', productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);

app.get('/', (req, res) => {
    res.send('Hello World API Server');
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
    });

  
