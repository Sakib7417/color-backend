const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const env = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth.routes');
const walletRoutes = require('./routes/wallet.routes');
const gameRoutes = require('./routes/game.routes');
const adminRoutes = require('./routes/admin.routes');
const riskDashboardRoutes = require('./routes/riskDashboard.routes');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Rate limiting - DISABLED for development
// const limiter = rateLimit({
//   windowMs: env.RATE_LIMIT_WINDOW_MS,
//   max: env.RATE_LIMIT_MAX_REQUESTS,
//   message: {
//     success: false,
//     message: 'Too many requests from this IP, please try again later.',
//   },
// });
// app.use(limiter);

// Stricter rate limiting for auth endpoints - DISABLED for development
const authLimiter = (req, res, next) => next(); // Bypass rate limit

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Risk Dashboard route
app.get('/admin/risk-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/risk-dashboard.html'));
});

// Alternative dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/risk-dashboard.html'));
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/admin', authLimiter, adminRoutes);
app.use('/api/admin/risk', authLimiter, riskDashboardRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Color Prediction Game API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/health',
  });
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
