const prisma = require('../config/database');
const { PAYOUTS, NUMBER_COLORS, NUMBER_SIZES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Bet Service - Handles betting logic
 */
class BetService {
  /**
   * Place a bet
   */
  async placeBet(userId, betData) {
    const { gameRoundId, betType, selection, amount } = betData;
    const betAmount = parseFloat(amount);

    // Check if game round exists and is active
    const gameRound = await prisma.gameRound.findUnique({
      where: { id: gameRoundId },
    });

    if (!gameRound) {
      throw new Error('Game round not found');
    }

    // Check round status for betting control
    if (gameRound.status === 'PAUSED') {
      throw new Error('Betting is temporarily paused for this round');
    }

    if (gameRound.status === 'CLOSED') {
      throw new Error('Betting is closed for this round');
    }

    if (gameRound.status === 'CANCELLED') {
      throw new Error('This round has been cancelled');
    }

    if (gameRound.status === 'RESULT_DECLARED') {
      throw new Error('Result already declared for this round');
    }

    if (gameRound.resultStatus === 'DECLARED') {
      throw new Error('Result already declared for this round');
    }

    // Check wallet balance
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet || parseFloat(wallet.balance) < betAmount) {
      throw new Error('Insufficient balance');
    }

    // Check if user already placed a bet on this round
    const existingBet = await prisma.bet.findFirst({
      where: {
        userId,
        gameRoundId,
      },
    });

    if (existingBet) {
      throw new Error('You have already placed a bet on this round');
    }

    // Calculate potential win
    let potentialWin = 0;
    const normalizedSelection = selection.toUpperCase();

    if (betType === 'COLOR') {
      const multiplier = PAYOUTS.COLOR[normalizedSelection] || 1.95;
      potentialWin = betAmount * multiplier;
    } else if (betType === 'NUMBER') {
      potentialWin = betAmount * PAYOUTS.NUMBER;
    } else if (betType === 'SIZE') {
      const multiplier = PAYOUTS.SIZE[normalizedSelection] || 1.95;
      potentialWin = betAmount * multiplier;
    }

    // Create bet and deduct balance in transaction
    const bet = await prisma.$transaction(async (tx) => {
      // Deduct from wallet
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: {
            decrement: betAmount,
          },
        },
      });

      // Create bet
      const newBet = await tx.bet.create({
        data: {
          userId,
          gameRoundId,
          betType,
          selection: normalizedSelection,
          amount: betAmount,
          potentialWin,
          result: 'PENDING',
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: 'BET_PLACED',
          amount: betAmount,
          status: 'COMPLETED',
          referenceId: newBet.id,
          description: `Bet placed on ${betType}: ${normalizedSelection}`,
        },
      });

      return newBet;
    });

    logger.info(`Bet placed: ${bet.id} by user: ${userId}`);

    // Notify risk dashboard of new bet
    try {
      const app = require('../app');
      const riskDashboardSocket = app.get('riskDashboardSocket');
      if (riskDashboardSocket) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, mobileNumber: true, name: true },
        });
        
        riskDashboardSocket.notifyNewBet(gameRoundId, {
          id: bet.id,
          userId: bet.userId,
          userName: user?.name,
          userMobile: user?.mobileNumber,
          betType: bet.betType,
          selection: bet.selection,
          amount: parseFloat(bet.amount),
          potentialWin: parseFloat(bet.potentialWin),
          createdAt: bet.createdAt,
        });
      }
    } catch (err) {
      logger.error('Error notifying risk dashboard:', err);
    }

    return bet;
  }

  /**
   * Get user's bet history
   */
  async getUserBets(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          gameRound: {
            select: {
              period: true,
              number: true,
              winningColor: true,
              winningSize: true,
              status: true,
            },
          },
        },
      }),
      prisma.bet.count({ where: { userId } }),
    ]);

    return { bets, total, page, limit };
  }

  /**
   * Get bets for a specific game round
   */
  async getRoundBets(userId, gameRoundId) {
    const bets = await prisma.bet.findMany({
      where: {
        userId,
        gameRoundId,
      },
      include: {
        gameRound: {
          select: {
            period: true,
            number: true,
            winningColor: true,
            winningSize: true,
            status: true,
          },
        },
      },
    });

    return bets;
  }

  /**
   * Get all bets (for admin)
   */
  async getAllBets(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              mobileNumber: true,
              name: true,
            },
          },
          gameRound: {
            select: {
              period: true,
              number: true,
              winningColor: true,
              winningSize: true,
            },
          },
        },
      }),
      prisma.bet.count(),
    ]);

    return { bets, total, page, limit };
  }

  /**
   * Process bets for a completed round
   */
  async processBets(roundId, winningNumber, winningColor, winningSize) {
    const bets = await prisma.bet.findMany({
      where: { gameRoundId: roundId },
    });

    for (const bet of bets) {
      let isWin = false;
      let winAmount = 0;

      if (bet.betType === 'NUMBER') {
        const betNumber = parseInt(bet.selection);
        if (betNumber === winningNumber) {
          isWin = true;
          winAmount = parseFloat(bet.amount) * PAYOUTS.NUMBER;
        }
      } else if (bet.betType === 'COLOR') {
        const betColor = bet.selection;
        if (betColor === 'VIOLET' && (winningNumber === 0 || winningNumber === 5)) {
          isWin = true;
          winAmount = parseFloat(bet.amount) * PAYOUTS.COLOR.VIOLET;
        } else if (betColor === winningColor) {
          isWin = true;
          winAmount = parseFloat(bet.amount) * PAYOUTS.COLOR[winningColor];
        }
      } else if (bet.betType === 'SIZE') {
        const betSize = bet.selection;
        if (betSize === winningSize) {
          isWin = true;
          winAmount = parseFloat(bet.amount) * PAYOUTS.SIZE[winningSize];
        }
      }

      // Update bet result
      await prisma.$transaction(async (tx) => {
        await tx.bet.update({
          where: { id: bet.id },
          data: {
            result: isWin ? 'WON' : 'LOST',
            winAmount: isWin ? winAmount : 0,
          },
        });

        if (isWin) {
          // Add winnings to user wallet
          await tx.wallet.update({
            where: { userId: bet.userId },
            data: {
              balance: {
                increment: winAmount,
              },
            },
          });

          // Create transaction record
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: 'BET_WON',
              amount: winAmount,
              status: 'COMPLETED',
              referenceId: bet.id,
              description: `Won bet on ${bet.betType}: ${bet.selection}`,
            },
          });
        }
      });
    }

    logger.info(`Processed ${bets.length} bets for round: ${roundId}`);
  }
}

module.exports = new BetService();
