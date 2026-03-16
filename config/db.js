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
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI tanımlı değil');
  }
  const dbName = uri.includes('/?') || uri.endsWith('/')
    ? uri.replace(/\/?$/, '/hepsidb')
    : uri;

  await mongoose.connect(dbName);
};

export default connectDB;
 
