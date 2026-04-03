import mongoose from 'mongoose';
import { MONGO_URI } from './env';

const connectDB = async (): Promise<void> => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Connection failed: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;