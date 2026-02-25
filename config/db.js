import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

/* const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
 }

  */


 const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        // Eğer URI'de veritabanı adı yoksa, hepsidb ekle
        const dbName = uri.includes('/?') || uri.endsWith('/') 
            ? uri.replace(/\/?$/, '/hepsidb') 
            : uri;
        
        await mongoose.connect(dbName);
        console.log('Connected to MongoDB - Database: hepsidb');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}
export default connectDB;
 
