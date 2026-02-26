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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// İzin verilen frontend URL'leri (lokalde .env'den, canlıda env variable'dan gelir)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,        // Vercel URL: https://sakagibiya.vercel.app
].filter(Boolean); // undefined olanları çıkar

app.use(cors({
    origin: (origin, callback) => {
      // Postman gibi origin'siz araçlara da izin ver (opsiyonel)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: ${origin} adresine izin verilmiyor.`));
      }
    },
    credentials: true,
  }));

//routes
app.use('/api/products', productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);

app.get('/', (req, res) => {
    res.send('Hello World API Server');
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
    });

  
