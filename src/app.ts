import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { NODE_ENV } from './config/env';
import { errorHandler } from './middlewares/errorHandler.middlewares';

// routes
//import authRoutes from './modules/auth/auth.routes';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// api routes
//app.use('/api/auth', authRoutes);

// health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.use(errorHandler);

export default app;