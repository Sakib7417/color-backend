const riskDashboardService = require('../services/riskDashboard.service');
const gameAdminService = require('../services/gameAdmin.service');
const logger = require('../utils/logger');

/**
 * Risk Dashboard WebSocket Handler
 * Manages real-time updates for admin risk dashboard
 */
class RiskDashboardSocket {
  constructor(io) {
    this.io = io;
    this.adminNamespace = io.of('/admin-risk');
    this.activeRooms = new Map(); // gameRoundId -> Set of socket ids
    this.updateIntervals = new Map(); // gameRoundId -> interval id

    this.setupNamespace();
  }

  /**
   * Setup admin namespace with authentication
   */
  setupNamespace() {
    this.adminNamespace.use(async (socket, next) => {
      try {
        // Get token from query or auth header
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify token (reuse your existing auth logic)
        const { verifyToken } = require('../utils/auth');
        const decoded = verifyToken(token);

        if (!decoded.adminId) {
          return next(new Error('Admin access required'));
        }

        // Check if admin exists and is active
        const prisma = require('../config/database');
        const admin = await prisma.admin.findUnique({
          where: { id: decoded.adminId },
          select: { id: true, mobileNumber: true, role: true, isActive: true },
        });

        if (!admin || !admin.isActive) {
          return next(new Error('Invalid or inactive admin'));
        }

        socket.adminId = admin.id;
        socket.adminRole = admin.role;
        next();
      } catch (err) {
        logger.error('Socket authentication error:', err);
        next(new Error('Authentication failed'));
      }
    });

    this.adminNamespace.on('connection', (socket) => {
      logger.info(`Admin connected to risk dashboard: ${socket.adminId}`);

      // Send initial data
      this.sendInitialData(socket);

      // Handle subscription to specific round
      socket.on('subscribe-round', (gameRoundId) => {
        this.subscribeToRound(socket, gameRoundId);
      });

      // Handle unsubscribe
      socket.on('unsubscribe-round', (gameRoundId) => {
        this.unsubscribeFromRound(socket, gameRoundId);
      });

      // Handle admin actions
      socket.on('force-result', async (data) => {
        await this.handleForceResult(socket, data);
      });

      socket.on('auto-result', async (data) => {
        await this.handleAutoResult(socket, data);
      });

      socket.on('cancel-round', async (data) => {
        await this.handleCancelRound(socket, data);
      });

      socket.on('pause-betting', async (data) => {
        await this.handlePauseBetting(socket, data);
      });

      socket.on('resume-betting', async (data) => {
        await this.handleResumeBetting(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Send initial data to connected admin
   */
  async sendInitialData(socket) {
    try {
      const summary = await riskDashboardService.getRealtimeSummary();
      socket.emit('initial-data', summary);
    } catch (err) {
      logger.error('Error sending initial data:', err);
      socket.emit('error', { message: 'Failed to load initial data' });
    }
  }

  /**
   * Subscribe to real-time updates for a specific round
   */
  async subscribeToRound(socket, gameRoundId) {
    try {
      // Join the room for this round
      socket.join(`round-${gameRoundId}`);

      // Track active subscriptions
      if (!this.activeRooms.has(gameRoundId)) {
        this.activeRooms.set(gameRoundId, new Set());
      }
      this.activeRooms.get(gameRoundId).add(socket.id);

      // Send initial detailed data
      const analysis = await riskDashboardService.getRoundRiskAnalysis(gameRoundId);
      socket.emit('round-data', analysis);

      // Start real-time updates if not already started
      this.startRealtimeUpdates(gameRoundId);

      logger.info(`Admin ${socket.adminId} subscribed to round ${gameRoundId}`);
    } catch (err) {
      logger.error('Error subscribing to round:', err);
      socket.emit('error', { message: 'Failed to subscribe to round' });
    }
  }

  /**
   * Unsubscribe from round updates
   */
  unsubscribeFromRound(socket, gameRoundId) {
    socket.leave(`round-${gameRoundId}`);

    const room = this.activeRooms.get(gameRoundId);
    if (room) {
      room.delete(socket.id);
      
      // Stop updates if no more subscribers
      if (room.size === 0) {
        this.stopRealtimeUpdates(gameRoundId);
        this.activeRooms.delete(gameRoundId);
      }
    }

    logger.info(`Admin ${socket.adminId} unsubscribed from round ${gameRoundId}`);
  }

  /**
   * Start real-time updates for a round
   */
  startRealtimeUpdates(gameRoundId) {
    if (this.updateIntervals.has(gameRoundId)) {
      return; // Already updating
    }

    // Update every 2 seconds
    const intervalId = setInterval(async () => {
      try {
        const analysis = await riskDashboardService.getRoundRiskAnalysis(gameRoundId);
        
        // Broadcast to all subscribers of this round
        this.adminNamespace.to(`round-${gameRoundId}`).emit('round-update', {
          gameRoundId,
          timestamp: new Date(),
          data: analysis,
        });
      } catch (err) {
        logger.error(`Error updating round ${gameRoundId}:`, err);
      }
    }, 2000);

    this.updateIntervals.set(gameRoundId, intervalId);
    logger.info(`Started real-time updates for round ${gameRoundId}`);
  }

  /**
   * Stop real-time updates for a round
   */
  stopRealtimeUpdates(gameRoundId) {
    const intervalId = this.updateIntervals.get(gameRoundId);
    if (intervalId) {
      clearInterval(intervalId);
      this.updateIntervals.delete(gameRoundId);
      logger.info(`Stopped real-time updates for round ${gameRoundId}`);
    }
  }

  /**
   * Handle force result action
   */
  async handleForceResult(socket, { gameRoundId, winningOption }) {
    try {
      const result = await gameAdminService.declareResult(
        gameRoundId,
        winningOption,
        socket.adminId
      );

      // Broadcast result to all subscribers
      this.adminNamespace.to(`round-${gameRoundId}`).emit('result-declared', {
        gameRoundId,
        declaredBy: 'ADMIN',
        adminId: socket.adminId,
        result,
      });

      // Stop updates for this round
      this.stopRealtimeUpdates(gameRoundId);

      socket.emit('action-success', { action: 'force-result', result });
    } catch (err) {
      logger.error('Error forcing result:', err);
      socket.emit('action-error', { action: 'force-result', message: err.message });
    }
  }

  /**
   * Handle auto result action
   */
  async handleAutoResult(socket, { gameRoundId }) {
    try {
      const result = await gameAdminService.autoCalculateResult(gameRoundId);

      // Broadcast result to all subscribers
      this.adminNamespace.to(`round-${gameRoundId}`).emit('result-declared', {
        gameRoundId,
        declaredBy: 'SYSTEM',
        result,
      });

      // Stop updates for this round
      this.stopRealtimeUpdates(gameRoundId);

      socket.emit('action-success', { action: 'auto-result', result });
    } catch (err) {
      logger.error('Error auto-calculating result:', err);
      socket.emit('action-error', { action: 'auto-result', message: err.message });
    }
  }

  /**
   * Handle cancel round action
   */
  async handleCancelRound(socket, { gameRoundId }) {
    try {
      const result = await gameAdminService.cancelRound(gameRoundId, socket.adminId);

      // Broadcast cancellation to all subscribers
      this.adminNamespace.to(`round-${gameRoundId}`).emit('round-cancelled', {
        gameRoundId,
        cancelledBy: socket.adminId,
        result,
      });

      // Stop updates for this round
      this.stopRealtimeUpdates(gameRoundId);

      socket.emit('action-success', { action: 'cancel-round', result });
    } catch (err) {
      logger.error('Error cancelling round:', err);
      socket.emit('action-error', { action: 'cancel-round', message: err.message });
    }
  }

  /**
   * Handle pause betting action
   */
  async handlePauseBetting(socket, { gameRoundId }) {
    try {
      const result = await gameAdminService.updateRoundStatus(gameRoundId, 'PAUSED');

      // Broadcast to all subscribers
      this.adminNamespace.to(`round-${gameRoundId}`).emit('status-changed', {
        gameRoundId,
        status: 'PAUSED',
        changedBy: socket.adminId,
      });

      socket.emit('action-success', { action: 'pause-betting', result });
    } catch (err) {
      logger.error('Error pausing betting:', err);
      socket.emit('action-error', { action: 'pause-betting', message: err.message });
    }
  }

  /**
   * Handle resume betting action
   */
  async handleResumeBetting(socket, { gameRoundId }) {
    try {
      const result = await gameAdminService.updateRoundStatus(gameRoundId, 'OPEN');

      // Broadcast to all subscribers
      this.adminNamespace.to(`round-${gameRoundId}`).emit('status-changed', {
        gameRoundId,
        status: 'OPEN',
        changedBy: socket.adminId,
      });

      socket.emit('action-success', { action: 'resume-betting', result });
    } catch (err) {
      logger.error('Error resuming betting:', err);
      socket.emit('action-error', { action: 'resume-betting', message: err.message });
    }
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(socket) {
    logger.info(`Admin disconnected from risk dashboard: ${socket.adminId}`);

    // Clean up subscriptions
    for (const [gameRoundId, room] of this.activeRooms.entries()) {
      if (room.has(socket.id)) {
        this.unsubscribeFromRound(socket, gameRoundId);
      }
    }
  }

  /**
   * Notify all connected admins of a new bet
   */
  async notifyNewBet(gameRoundId, betData) {
    try {
      const analysis = await riskDashboardService.getRoundRiskAnalysis(gameRoundId);
      
      this.adminNamespace.to(`round-${gameRoundId}`).emit('new-bet', {
        gameRoundId,
        bet: betData,
        updatedAnalysis: analysis,
      });
    } catch (err) {
      logger.error('Error notifying new bet:', err);
    }
  }

  /**
   * Broadcast global updates to all connected admins
   */
  broadcastGlobalUpdate(data) {
    this.adminNamespace.emit('global-update', data);
  }
}

module.exports = RiskDashboardSocket;
