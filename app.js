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
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
  }));

//routes
app.use('/api/products', productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/favorites", favoriteRoutes);

app.get('/', (req, res) => {
    res.send('Hello World API Server');
});

connectDB().then(() => {
    app.listen(5000, () => {
        console.log('Server is running on port 5000');
    });
    });

  
