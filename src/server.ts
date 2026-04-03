import './config/env';
import app from './app';
import connectDB from './config/db';
import { PORT } from './config/env';

const start = async (): Promise<void> => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

start();