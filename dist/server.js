"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const routes_1 = __importDefault(require("./routes"));
const sockets_1 = require("./sockets");
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
// 1. Security & Core Middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: false,
}));
app.use((0, cors_1.default)({
    origin: env_1.config.clientUrl === '*' ? '*' : [env_1.config.clientUrl, 'http://localhost:3000', 'http://localhost:8081'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use((0, morgan_1.default)(env_1.config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// 2. REST API Routes
app.use('/api', routes_1.default);
// Root Welcome Endpoint
app.get('/', (_req, res) => {
    res.status(200).json({
        message: 'Welcome to Dukan Bari Hyperlocal API & Real-Time Engine',
        version: '1.0.0',
        documentation: '/api/health'
    });
});
// 3. 404 Route Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Resource not found at ${req.method} ${req.originalUrl}`
    });
});
// 4. Global Error Handling Middleware
app.use((err, _req, res, _next) => {
    console.error('[Unhandled Server Error]', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: env_1.config.nodeEnv === 'development' ? err.message : undefined
    });
});
// 5. Initialize Socket.io Real-Time Engine
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 30000,
    pingInterval: 10000
});
exports.io = io;
(0, sockets_1.initializeSocketServer)(io);
// 6. Start HTTP + WebSocket Server
const PORT = env_1.config.port;
server.listen(PORT, () => {
    console.log(`
  ==============================================================
   🚀 Dukan Bari Platform Server is running!
   📡 Port: ${PORT}
   🌐 Environment: ${env_1.config.nodeEnv}
   ⚡ Real-Time Engine: Socket.io Active
   📍 PostGIS Geo-Spatial Engine: Supabase Connected
   🖼️ Media Storage: Cloudinary Ready
  ==============================================================
  `);
});
// Graceful Shutdown
const handleShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Gracefully shutting down Dukan Bari server...`);
    server.close(() => {
        console.log('HTTP & Socket.io server closed.');
        process.exit(0);
    });
};
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
