import './config/env';
import http from 'http';
import app from './app';
import connectDB from './config/db';
import { initSocket } from './config/socket';
import { PORT } from './config/env';

const start = async (): Promise<void> => {
  await connectDB();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start();
