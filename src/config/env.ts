import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config();

/**
 * Utility to ensure required environment variables are present
 */
const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is missing!`);
  }
  return value;
};

// Server Configuration
export const PORT: number = Number(process.env.PORT) || 5000;
export const NODE_ENV: string = process.env.NODE_ENV || 'development';
export const MONGO_URI: string = getEnvVar('MONGO_URI');

// JWT Configuration
export const JWT_SECRET: string = getEnvVar('JWT_SECRET');
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
export const JWT_REFRESH_SECRET: string = getEnvVar('JWT_REFRESH_SECRET', 'a_default_refresh_secret');
export const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// AWS Configuration
export const AWS_ACCESS_KEY_ID: string = getEnvVar('AWS_ACCESS_KEY_ID');
export const AWS_SECRET_ACCESS_KEY: string = getEnvVar('AWS_SECRET_ACCESS_KEY');
export const AWS_REGION: string = getEnvVar('AWS_REGION', 'eu-north-1');
export const S3_IMAGE_BUCKET: string = getEnvVar('S3_IMAGE_BUCKET');

// SMTP / Mail Configuration
export const SMTP_USER: string = getEnvVar('SMTP_USER');
export const SMTP_PASS: string = getEnvVar('SMTP_PASS');

// Stripe Configuration
export const STRIPE_SECRET_KEY: string = getEnvVar('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET: string = getEnvVar('STRIPE_WEBHOOK_SECRET');
export const STRIPE_PUBLISHABLE_KEY: string = getEnvVar('STRIPE_PUBLISHABLE_KEY');

// RevenueCat Configuration
export const REVENUECAT_WEBHOOK_SECRET: string = getEnvVar('REVENUECAT_WEBHOOK_SECRET');

// Client URL (for Stripe redirect after checkout)
export const CLIENT_URL: string = getEnvVar('CLIENT_URL', 'http://localhost:3000');

// Firebase
export const FIREBASE_SERVICE_ACCOUNT_PATH: string = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './src/config/firebase-service-account.json';

// Socket.IO
export const SOCKET_IO_CORS_ORIGIN: string = process.env.SOCKET_IO_CORS_ORIGIN || '*';