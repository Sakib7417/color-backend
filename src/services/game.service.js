const prisma = require('../config/database');
const { NUMBER_COLORS, NUMBER_SIZES } = require('../config/constants');
const gameAdminService = require('./gameAdmin.service');
const logger = require('../utils/logger');
const env = require('../config/env');

// Game configuration
const ROUND_DURATION = env.GAME_ROUND_DURATION;

/**
 * Game Service - Handles game round lifecycle and result calculation
 */
class GameService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Start the game service
   */
  start() {
    if (this.isRunning) {
      logger.warn('Game service is already running');
      return;
    }

    logger.game('Starting game service...');
    this.isRunning = true;

    // Check and create initial game round
    this.ensureActiveRound();

    // Start the game loop
    this.intervalId = setInterval(() => {
      this.processGameRounds();
    }, 1000); // Check every second

    logger.game(`Game service started. Round duration: ${ROUND_DURATION} seconds`);
  }

  /**
   * Stop the game service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.game('Game service stopped');
  }

  /**
   * Ensure there's an active game round
   */
  async ensureActiveRound() {
    try {
      const activeRound = await prisma.gameRound.findFirst({
        where: { 
          status: { in: ['OPEN', 'PAUSED'] },
          resultStatus: 'PENDING',
        },
      });

      if (!activeRound) {
        logger.game('Creating new game round...');
        await this.createNewGameRound();
      }
    } catch (err) {
      logger.error('Error ensuring active round:', err);
    }
  }

  /**
   * Process game rounds - check for expired rounds and auto-calculate results
   */
  async processGameRounds() {
    try {
      // Find expired OPEN rounds that haven't been manually controlled
      const expiredRounds = await prisma.gameRound.findMany({
        where: {
          status: 'OPEN',
          resultStatus: 'PENDING',
          startTime: {
            lte: new Date(Date.now() - ROUND_DURATION * 1000),
          },
        },
        include: {
          bets: true,
        },
      });

      for (const round of expiredRounds) {
        // Auto-close betting and calculate result using system logic
        await this.autoCompleteRound(round);
      }

      // Ensure there's always an active round
      const activeRound = await prisma.gameRound.findFirst({
        where: { 
          status: { in: ['OPEN', 'PAUSED'] },
          resultStatus: 'PENDING',
        },
      });

      if (!activeRound) {
        await this.createNewGameRound();
      }
    } catch (err) {
      logger.error('Error processing game rounds:', err);
    }
  }

  /**
   * Create a new game round
   */
  async createNewGameRound() {
    const now = new Date();
    const period = await this.generatePeriodNumber(now);

    // Check if round already exists
    const existingRound = await prisma.gameRound.findUnique({
      where: { period },
    });

    if (existingRound) {
      return existingRound;
    }

    const gameRound = await prisma.gameRound.create({
      data: {
        period,
        status: 'OPEN',
        resultStatus: 'PENDING',
        startTime: now,
      },
    });

    logger.game(`New game round created: ${period}`);
    return gameRound;
  }

  /**
   * Auto-complete a game round using system calculation
   */
  async autoCompleteRound(round) {
    logger.game(`Auto-completing round: ${round.period}`);

    try {
      // Use gameAdminService to auto-calculate and save result
      await gameAdminService.autoCalculateResult(round.id);
      logger.game(`Round ${round.period} auto-completed by system`);
    } catch (err) {
      logger.error(`Error auto-completing round ${round.period}:`, err);
    }
  }

  /**
   * Calculate winning number based on minimum bet strategy
   */
  async calculateWinningNumber(roundId) {
    try {
      // Get all bets for this round
      const bets = await prisma.bet.findMany({
        where: { gameRoundId: roundId },
      });

      if (bets.length === 0) {
        // No bets, return random number
        return Math.floor(Math.random() * 10);
      }

      // Calculate total bets per number
      const numberBets = {};
      for (let i = 0; i <= 9; i++) {
        numberBets[i] = 0;
      }

      for (const bet of bets) {
        if (bet.betType === 'NUMBER') {
          const num = parseInt(bet.selection);
          numberBets[num] += parseFloat(bet.amount);
        } else if (bet.betType === 'COLOR') {
          for (let i = 0; i <= 9; i++) {
            if (NUMBER_COLORS[i] === bet.selection || 
                (bet.selection === 'VIOLET' && (i === 0 || i === 5))) {
              numberBets[i] += parseFloat(bet.amount);
            }
          }
        } else if (bet.betType === 'SIZE') {
          for (let i = 0; i <= 9; i++) {
            if (NUMBER_SIZES[i] === bet.selection) {
              numberBets[i] += parseFloat(bet.amount);
            }
          }
        }
      }

      // Find number(s) with minimum bet
      let minBet = Infinity;
      let winningNumbers = [];

      for (let i = 0; i <= 9; i++) {
        if (numberBets[i] < minBet) {
          minBet = numberBets[i];
          winningNumbers = [i];
        } else if (numberBets[i] === minBet) {
          winningNumbers.push(i);
        }
      }

      // If multiple numbers have same minimum bet, pick randomly
      const winningNumber = winningNumbers[Math.floor(Math.random() * winningNumbers.length)];
      
      return winningNumber;
    } catch (err) {
      logger.error('Error calculating winning number:', err);
      return Math.floor(Math.random() * 10);
    }
  }

  /**
   * Get current active game round
   */
  async getCurrentRound() {
    let gameRound = await prisma.gameRound.findFirst({
      where: { 
        status: { in: ['OPEN', 'PAUSED'] },
        resultStatus: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no active round, create one
    if (!gameRound) {
      gameRound = await this.createNewGameRound();
    }

    // Calculate remaining time
    const now = new Date();
    const endTime = new Date(gameRound.startTime);
    endTime.setSeconds(endTime.getSeconds() + ROUND_DURATION);
    
    const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));

    return {
      ...gameRound,
      remainingTime,
      roundDuration: ROUND_DURATION,
    };
  }

  /**
   * Get game history
   */
  async getGameHistory(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [gameRounds, total] = await Promise.all([
      prisma.gameRound.findMany({
        where: { 
          resultStatus: 'DECLARED',
        },
        orderBy: { endTime: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          period: true,
          number: true,
          winningColor: true,
          winningSize: true,
          resultDeclaredBy: true,
          endTime: true,
        },
      }),
      prisma.gameRound.count({ where: { resultStatus: 'DECLARED' } }),
    ]);

    return { gameRounds, total, page, limit };
  }

  /**
   * Get all game rounds (for admin)
   */
  async getAllRounds(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [gameRounds, total] = await Promise.all([
      prisma.gameRound.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { bets: true },
          },
        },
      }),
      prisma.gameRound.count(),
    ]);

    return { gameRounds, total, page, limit };
  }

  /**
   * Generate period number based on current time
   * Format: YYYYMMDD + sequential number (0001, 0002, etc.)
   */
  async generatePeriodNumber(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Find the last round of today
    const lastRound = await prisma.gameRound.findFirst({
      where: {
        period: {
          startsWith: datePrefix,
        },
      },
      orderBy: {
        period: 'desc',
      },
    });

    let sequence = 1;
    if (lastRound) {
      // Extract sequence from last period (last 4 digits)
      const lastSequence = parseInt(lastRound.period.slice(-4));
      sequence = lastSequence + 1;
    }

    // Format sequence as 4 digits (0001, 0002, etc.)
    const sequenceStr = String(sequence).padStart(4, '0');
    return `${datePrefix}${sequenceStr}`;
  }
}

// Export singleton instance
module.exports = new GameService();
