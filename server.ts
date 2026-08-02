import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { setupSocketHandlers } from './src/server/socketHandler.js';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e7, // 10MB max buffer for frame streams
  });

  setupSocketHandlers(io);

  // API status route
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      app: 'VisionMix',
      time: new Date().toISOString(),
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static build in production
    // In production, we assume we are running from dist/server.cjs
    // process.cwd() is the root of the project
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[VisionMix Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
