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
import adminAuthRouter from './modules/admin/auth/admin.auth.router';
import adminProfileRouter from './modules/admin/profile/admin.profile.router';
import editorAuthRouter from './modules/editor/auth/editor.auth.router';
import editorProfileRouter from './modules/editor/profile/editor.profile.router';
import storyRouter from './modules/common/story/story.router';
import podcastRouter from './modules/common/podcast/podcast.router';
import liveNewsRouter from './modules/common/liveNews/liveNews.router';

const app: Application = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Routes auth/profile ──────────────────────────────
app.use('/api/v1/reader/auth', readerAuthRouter);
app.use('/api/v1/reader/profile', readerProfileRouter);
app.use('/api/v1/writer/auth', writerAuthRouter);
app.use('/api/v1/writer/profile', writerProfileRouter);
app.use('/api/v1/admin/auth', adminAuthRouter);
app.use('/api/v1/admin/profile', adminProfileRouter);
app.use('/api/v1/editor/auth', editorAuthRouter);
app.use('/api/v1/editor/profile', editorProfileRouter)
// ── Routes auth/profile ──────────────────────────────

// ── Routes post/story or any  ──────────────────────────────
app.use('/api/v1/story', storyRouter);
app.use('/api/v1/podcast', podcastRouter);
app.use('/api/v1/live-news', liveNewsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, status: 'Server is running' });
});

// Global error handler 
app.use(errorHandler);

export default app;