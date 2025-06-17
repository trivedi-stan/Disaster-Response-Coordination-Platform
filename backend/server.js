const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./src/utils/logger');
const { connectSupabase } = require('./src/config/database');
const { authMiddleware } = require('./src/middleware/auth');
const { generalLimiter } = require('./src/middleware/rateLimit');
const { errorHandler } = require('./src/middleware/errorHandler');

// Import routes
const disasterRoutes = require('./src/routes/disasters');
const geocodeRoutes = require('./src/routes/geocode');
const socialMediaRoutes = require('./src/routes/socialMedia');
const resourceRoutes = require('./src/routes/resources');
const officialUpdatesRoutes = require('./src/routes/officialUpdates');
const imageVerificationRoutes = require('./src/routes/imageVerification');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(generalLimiter);

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/disasters', authMiddleware, disasterRoutes);
app.use('/api/geocode', authMiddleware, geocodeRoutes);
app.use('/api/social-media', authMiddleware, socialMediaRoutes);
app.use('/api/resources', authMiddleware, resourceRoutes);
app.use('/api/official-updates', authMiddleware, officialUpdatesRoutes);
app.use('/api/verify-image', authMiddleware, imageVerificationRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join_disaster', (disasterId) => {
    socket.join(`disaster_${disasterId}`);
    logger.info(`Client ${socket.id} joined disaster room: ${disasterId}`);
  });

  socket.on('leave_disaster', (disasterId) => {
    socket.leave(`disaster_${disasterId}`);
    logger.info(`Client ${socket.id} left disaster room: ${disasterId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Initialize database connection and start server
async function startServer() {
  try {
    await connectSupabase();
    logger.info('Database connection established');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

startServer();

module.exports = { app, io };
