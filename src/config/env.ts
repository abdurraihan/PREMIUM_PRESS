import dotenv from 'dotenv';
dotenv.config();

// Server
export const PORT: number = Number(process.env.PORT) || 5000;
export const MONGO_URI: string = process.env.MONGO_URI!;
export const NODE_ENV: string = process.env.NODE_ENV || 'development';

// JWT
export const JWT_SECRET: string = process.env.JWT_SECRET!;
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
export const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET!;
export const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '30d';