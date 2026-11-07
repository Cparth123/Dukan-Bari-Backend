require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Internal Modules
const { initSocket } = require('./socket');
const { db, isMock } = require('./config/firebase');

// Route Handlers
const authRoutes = require('./routes/auth.routes');
const storeRoutes = require('./routes/store.routes');
const productRoutes = require('./routes/product.routes');
const conversationRoutes = require('./routes/conversation.routes');
const enquiryRoutes = require('./routes/enquiry.routes');
const offerRoutes = require('./routes/offer.routes');
const reviewRoutes = require('./routes/review.routes');
const uploadRoutes = require('./routes/upload.routes');

const app = express();
const server = http.createServer(app);

// 1. Initialize Socket.io
const io = initSocket(server);

// 2. Global Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads folder for local fallback
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Static APK downloads folder
app.use('/apk', express.static(path.join(__dirname, '../../apk')));

// 3. Request Logger in Development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// 4. Platform Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Dukan Bari Node.js + Firebase Backend Server',
    database: isMock ? 'Local In-Memory Mode' : 'Cloud Firestore',
    socket: 'active',
    timestamp: new Date().toISOString()
  });
});

// 5. Mount API Routes
app.all(['/api/reset-database', '/api/dev/reset-database'], (req, res) => {
  const { clearAllCache } = require('./config/firebase');
  const cacheResult = clearAllCache ? clearAllCache() : { purgedCollections: 0 };
  return res.json({
    success: true,
    message: 'Database memory cache wiped clean. All stale stores, users, and sessions have been reset.',
    details: cacheResult
  });
});
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/enquiries', enquiryRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/upload', uploadRoutes);

// 6. 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `API Route not found: ${req.method} ${req.originalUrl}`
  });
});

// 7. Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 8. Start Server
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log('========================================================');
    console.log(`🚀 DUKAN BARI BACKEND RUNNING ON http://localhost:${PORT}`);
    console.log(`   Database: ${isMock ? 'In-Memory / Local Mode' : 'Cloud Firestore'}`);
    console.log(`   Socket.io: Ready for live chat, bids & radar`);
    console.log('========================================================');
  });
}

module.exports = { app, server };

