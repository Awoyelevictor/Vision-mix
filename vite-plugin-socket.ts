import { Plugin } from 'vite';
import { Server as SocketIOServer } from 'socket.io';
import { setupSocketHandlers } from './src/server/socketHandler';

export function socketPlugin(): Plugin {
  return {
    name: 'vite-plugin-socket',
    configureServer(server) {
      if (!server.httpServer) return;

      const io = new SocketIOServer(server.httpServer, {
        cors: {
          origin: '*',
          methods: ['GET', 'POST'],
        },
        maxHttpBufferSize: 1e7,
      });

      setupSocketHandlers(io);
      console.log('[VisionMix Vite Plugin] Socket.IO server initialized on dev server.');
    },
  };
}
