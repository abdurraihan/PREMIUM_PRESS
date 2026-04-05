import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { NODE_ENV } from './config/env';
import { errorHandler } from './middlewares/errorHandler.middlewares';

// Reader routes
import readerAuthRouter from './modules/reader/auth/reader.router';
import readerProfileRouter from './modules/reader/profile/reader.prorile.router';
import writerAuthRouter from './modules/writer/auth/writer.auth.router';
import writerProfileRouter from './modules/writer/profile/writer.profile.router';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Routes ──────────────────────────────
app.use('/api/v1/reader/auth', readerAuthRouter);
app.use('/api/v1/reader/profile', readerProfileRouter);
app.use('/api/v1/writer/auth', writerAuthRouter);
app.use('/api/v1/writer/profile', writerProfileRouter);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, status: 'Server is running' });
});

// Global error handler — must be last
app.use(errorHandler);

export default app;