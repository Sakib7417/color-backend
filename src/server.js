const app = require('./app');
const prisma = require('./config/database');
const gameService = require('./services/game.service');
const env = require('./config/env');
const logger = require('./utils/logger');
const { createServer } = require('http');
const { Server } = require('socket.io');
const RiskDashboardSocket = require('./websocket/riskDashboard.socket');

const PORT = env.PORT;

// Create HTTP server
const httpServer = createServer(app);

// Setup Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize Risk Dashboard WebSocket
const riskDashboardSocket = new RiskDashboardSocket(io);

// Make io accessible to other modules
app.set('io', io);
app.set('riskDashboardSocket', riskDashboardSocket);

// Start server
const server = httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║         🎮 Color Prediction Game API Server 🎮            ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT}                            ║
║  Environment: ${env.NODE_ENV}                                    ║
║  Database: PostgreSQL                                       ║
║  API URL: http://localhost:${PORT}                          ║
║  WebSocket: ws://localhost:${PORT}                          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Start game service
  gameService.start();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  
  gameService.stop();
  
  server.close(async () => {
    logger.info('Server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  
  gameService.stop();
  
  server.close(async () => {
    logger.info('Server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
