import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config/env';
import apiRouter from './routes';
import { initializeSocketServer } from './sockets';

const app = express();
const server = http.createServer(app);

// 1. Security & Core Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

app.use(cors({
  origin: config.clientUrl === '*' ? '*' : [config.clientUrl, 'http://localhost:3000', 'http://localhost:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. REST API Routes
app.use('/api', apiRouter);

// Root Welcome Endpoint
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to Dukan Bari Hyperlocal API & Real-Time Engine',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

// 3. 404 Route Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Resource not found at ${req.method} ${req.originalUrl}`
  });
});

// 4. Global Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: config.nodeEnv === 'development' ? err.message : undefined
  });
});

// 5. Initialize Socket.io Real-Time Engine
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 10000
});

initializeSocketServer(io);

// 6. Start HTTP + WebSocket Server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`
  ==============================================================
   🚀 Dukan Bari Platform Server is running!
   📡 Port: ${PORT}
   🌐 Environment: ${config.nodeEnv}
   ⚡ Real-Time Engine: Socket.io Active
   📍 PostGIS Geo-Spatial Engine: Supabase Connected
   🖼️ Media Storage: Cloudinary Ready
  ==============================================================
  `);
});

// Graceful Shutdown
const handleShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Gracefully shutting down Dukan Bari server...`);
  server.close(() => {
    console.log('HTTP & Socket.io server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export { app, server, io };
