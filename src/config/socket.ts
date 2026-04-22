import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { SOCKET_IO_CORS_ORIGIN } from './env';

let io: Server;

const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: { origin: SOCKET_IO_CORS_ORIGIN, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    socket.on('register', (userId: string) => {
      socket.join(userId);
      console.log(`Socket registered: ${userId}`);
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
};

const sendSocketNotification = (userId: string, event: string, data: object): void => {
  if (!io) return;
  io.to(userId).emit(event, data);
};

export { initSocket, sendSocketNotification };
