const prisma = require('../config/database');
const logger = require('../utils/logger');
const { PAYOUTS, NUMBER_COLORS, NUMBER_SIZES } = require('../config/constants');
const profitEngine = require('./profitEngine.service');

/**
 * Game Admin Service - Handles admin game control operations
 */
class GameAdminService {
  /**
   * Declare winning result for a round (Admin)
   */
  async declareResult(gameRoundId, winningOption, adminId) {
    const round = await prisma.gameRound.findUnique({
      where: { id: gameRoundId },
      include: { bets: true },
    });

    if (!round) {
      throw new Error('Game round not found');
    }

    if (round.resultStatus === 'DECLARED') {
      throw new Error('Result already declared for this round');
    }

    if (round.status === 'CANCELLED') {
      throw new Error('Cannot declare result for cancelled round');
    }

    // Validate admin result with profit engine
    const validation = await profitEngine.validateAdminResult(gameRoundId, winningOption);
    
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (validation.warning) {
      logger.warn(`[Admin Declare] ${validation.warning}`);
    }

    // Parse winning option
    let winningNumber = null;
    let winningColor = null;
    let winningSize = null;

    // Check if it's a number (0-9)
    if (/^[0-9]$/.test(winningOption)) {
      winningNumber = parseInt(winningOption);
      winningColor = NUMBER_COLORS[winningNumber];
      winningSize = NUMBER_SIZES[winningNumber];
    }
    // Check if it's a color
    else if (['GREEN', 'RED', 'VIOLET'].includes(winningOption.toUpperCase())) {
      winningColor = winningOption.toUpperCase();
      // Find a number with this color (for consistency)
      const numbersWithColor = Object.entries(NUMBER_COLORS)
        .filter(([num, color]) => color === winningColor)
        .map(([num]) => parseInt(num));
      winningNumber = numbersWithColor[0] || 0;
      winningSize = NUMBER_SIZES[winningNumber];
    }
    // Check if it's a size
    else if (['BIG', 'SMALL'].includes(winningOption.toUpperCase())) {
      winningSize = winningOption.toUpperCase();
      // Find a number with this size
      const numbersWithSize = Object.entries(NUMBER_SIZES)
        .filter(([num, size]) => size === winningSize)
        .map(([num]) => parseInt(num));
      winningNumber = numbersWithSize[0] || 0;
      winningColor = NUMBER_COLORS[winningNumber];
    } else {
      throw new Error('Invalid winning option. Must be 0-9, GREEN, RED, VIOLET, BIG, or SMALL');
    }

    // Calculate profit data for admin-declared result
    const calculation = await profitEngine.calculateAllResultsLiability(gameRoundId);
    const selectedResult = calculation?.results.find(r => r.number === winningNumber);

    // Update round with admin-declared result and profit data
    const updatedRound = await prisma.gameRound.update({
      where: { id: gameRoundId },
      data: {
        number: winningNumber,
        winningColor: winningColor,
        winningSize: winningSize,
        status: 'RESULT_DECLARED',
        resultStatus: 'DECLARED',
        resultDeclaredBy: 'ADMIN',
        declaredAt: new Date(),
        declaredByAdminId: adminId,
        endTime: new Date(),
        totalCollection: selectedResult?.totalCollection || 0,
        totalPayout: selectedResult?.totalLiability || 0,
        profit: selectedResult?.profit || 0,
        profitPercent: selectedResult?.profitPercent || 0,
        calculationData: calculation ? JSON.stringify(calculation.results) : null,
        selectedResultRank: 'ADMIN_DECLARED',
        isProfitable: selectedResult?.isProfitable || false,
        lossAmount: selectedResult?.profit < 0 ? Math.abs(selectedResult.profit) : null,
      },
    });

    // Process bets with admin result
    await this.processBetsWithResult(round.id, winningNumber, winningColor, winningSize);

    logger.info(`Admin ${adminId} declared result for round ${gameRoundId}: ${winningOption} (Profit: ${selectedResult?.profit || 0})`);

    // Cleanup old game rounds - keep only latest 500
    await this.cleanupOldRounds();

    return {
      message: 'Result declared successfully',
      round: updatedRound,
      winningNumber,
      winningColor,
      winningSize,
      profit: selectedResult?.profit || 0,
      profitPercent: selectedResult?.profitPercent || 0,
    };
  }

  /**
   * Cleanup old game rounds - keep only latest 500 completed rounds
   */
  async cleanupOldRounds() {
    try {
      // Count completed rounds
      const roundCount = await prisma.gameRound.count({
        where: { resultStatus: 'DECLARED' },
      });

      // If more than 500, delete oldest ones
      if (roundCount > 500) {
        const roundsToDelete = roundCount - 500;

        // Find oldest completed rounds to delete
        const oldRounds = await prisma.gameRound.findMany({
          where: { resultStatus: 'DECLARED' },
          orderBy: { declaredAt: 'asc' },
          take: roundsToDelete,
          select: { id: true },
        });

        const roundIds = oldRounds.map(r => r.id);

        // Delete related bets first (foreign key constraint)
        await prisma.bet.deleteMany({
          where: {
            gameRoundId: {
              in: roundIds,
            },
          },
        });

        // Delete old rounds
        await prisma.gameRound.deleteMany({
          where: {
            id: {
              in: roundIds,
            },
          },
        });

        logger.info(`Cleaned up ${roundsToDelete} old game rounds`);
      }
    } catch (err) {
      logger.error('Error cleaning up old rounds:', err);
    }
  }

  /**
   * Update round status (OPEN, PAUSED, CLOSED)
   */
  async updateRoundStatus(gameRoundId, status) {
    const validStatuses = ['OPEN', 'PAUSED', 'CLOSED'];
    
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const round = await prisma.gameRound.findUnique({
      where: { id: gameRoundId },
    });

    if (!round) {
      throw new Error('Game round not found');
    }

    if (round.status === 'CANCELLED' || round.status === 'RESULT_DECLARED') {
      throw new Error(`Cannot change status of ${round.status.toLowerCase()} round`);
    }

    // Prevent reopening a closed round if result is already declared
    if (round.resultStatus === 'DECLARED' && status === 'OPEN') {
      throw new Error('Cannot reopen round after result is declared');
    }

    const updatedRound = await prisma.gameRound.update({
      where: { id: gameRoundId },
      data: { status },
    });

    logger.info(`Round ${gameRoundId} status changed to ${status}`);

    return {
      message: `Round status updated to ${status}`,
      round: updatedRound,
    };
  }

  /**
   * Cancel round and refund all bets
   */
  async cancelRound(gameRoundId, adminId) {
    const round = await prisma.gameRound.findUnique({
      where: { id: gameRoundId },
      include: { bets: true },
    });

    if (!round) {
      throw new Error('Game round not found');
    }

    if (round.status === 'CANCELLED') {
      throw new Error('Round already cancelled');
    }

    if (round.resultStatus === 'DECLARED') {
      throw new Error('Cannot cancel round after result is declared');
    }

    // Process refunds for all bets
    await prisma.$transaction(async (tx) => {
      // Update round status
      await tx.gameRound.update({
        where: { id: gameRoundId },
        data: {
          status: 'CANCELLED',
          endTime: new Date(),
        },
      });

      // Refund all bets
      for (const bet of round.bets) {
        if (bet.result === 'PENDING') {
          // Refund to user wallet
          await tx.wallet.update({
            where: { userId: bet.userId },
            data: {
              balance: {
                increment: parseFloat(bet.amount),
              },
            },
          });

          // Update bet result to cancelled
          await tx.bet.update({
            where: { id: bet.id },
            data: {
              result: 'CANCELLED',
              winAmount: 0,
            },
          });

          // Create refund transaction
          await tx.transaction.create({
            data: {
              userId: bet.userId,
              type: 'REFUND',
              amount: parseFloat(bet.amount),
              status: 'COMPLETED',
              referenceId: bet.id,
              description: `Refund for cancelled round ${round.period}`,
            },
          });
        }
      }
    });

    logger.info(`Admin ${adminId} cancelled round ${gameRoundId} and refunded ${round.bets.length} bets`);

    return {
      message: 'Round cancelled and all bets refunded',
      refundedBets: round.bets.length,
    };
  }

  /**
   * Get all rounds with filtering
   */
  async getRounds(page = 1, limit = 10, status = null) {
    const skip = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }

    const [rounds, total] = await Promise.all([
      prisma.gameRound.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { bets: true },
          },
        },
      }),
      prisma.gameRound.count({ where }),
    ]);

    return { rounds, total, page, limit };
  }

  /**
   * Get round details with bets
   */
  async getRoundDetails(gameRoundId) {
    const round = await prisma.gameRound.findUnique({
      where: { id: gameRoundId },
      include: {
        bets: {
          include: {
            user: {
              select: {
                id: true,
                mobileNumber: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!round) {
      throw new Error('Game round not found');
    }

    // Calculate bet statistics
    const stats = {
      totalBets: round.bets.length,
      totalAmount: round.bets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0),
      colorBets: round.bets.filter(b => b.betType === 'COLOR').length,
      numberBets: round.bets.filter(b => b.betType === 'NUMBER').length,
      sizeBets: round.bets.filter(b => b.betType === 'SIZE').length,
    };

    return { round, stats };
  }

  /**
   * Process bets with a specific result
   */
  async processBetsWithResult(roundId, winningNumber, winningColor, winningSize) {
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
          // Special case: if winning number is 0 or 5 (dual-color), use reduced payout for GREEN/RED
          if ((winningNumber === 0 && betColor === 'GREEN') || (winningNumber === 5 && betColor === 'RED')) {
            winAmount = parseFloat(bet.amount) * 1.45; // 45% return
          } else {
            winAmount = parseFloat(bet.amount) * PAYOUTS.COLOR[winningColor];
          }
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

  /**
   * Auto-calculate result using profit engine (System)
   */
  async autoCalculateResult(gameRoundId) {
    // Use profit engine to calculate optimal result
    const optimalResult = await profitEngine.calculateOptimalResult(gameRoundId);

    if (!optimalResult) {
      // No bets, pick random number
      const randomNumber = Math.floor(Math.random() * 10);
      return this.saveSystemResult(gameRoundId, randomNumber, null);
    }

    // Store calculation data
    const calculation = await profitEngine.calculateAllResultsLiability(gameRoundId);
    await profitEngine.storeCalculationData(gameRoundId, optimalResult, calculation);

    return this.saveSystemResult(
      gameRoundId, 
      optimalResult.number, 
      optimalResult,
      calculation
    );
  }

  /**
   * Save system-calculated result
   */
  async saveSystemResult(gameRoundId, winningNumber, profitData = null, calculation = null) {
    const winningColor = NUMBER_COLORS[winningNumber];
    const winningSize = NUMBER_SIZES[winningNumber];

    const updateData = {
      number: winningNumber,
      winningColor: winningColor,
      winningSize: winningSize,
      status: 'RESULT_DECLARED',
      resultStatus: 'DECLARED',
      resultDeclaredBy: 'SYSTEM',
      declaredAt: new Date(),
      endTime: new Date(),
    };

    // Add profit data if available
    if (profitData) {
      updateData.totalCollection = profitData.totalCollection;
      updateData.totalPayout = profitData.totalLiability;
      updateData.profit = profitData.profit;
      updateData.profitPercent = profitData.profitPercent;
      updateData.selectedResultRank = profitData.selectedRank;
      updateData.isProfitable = profitData.isProfitable;
      updateData.lossAmount = profitData.profit < 0 ? Math.abs(profitData.profit) : null;
    }

    if (calculation) {
      updateData.calculationData = JSON.stringify(calculation.results);
    }

    const updatedRound = await prisma.gameRound.update({
      where: { id: gameRoundId },
      data: updateData,
    });

    // Process bets
    await this.processBetsWithResult(gameRoundId, winningNumber, winningColor, winningSize);

    logger.info(`System calculated result for round ${gameRoundId}: ${winningNumber} (Profit: ${profitData?.profit || 0})`);

    return updatedRound;
  }

  /**
   * Get profit statistics for admin dashboard
   */
  async getProfitStats(startDate = null, endDate = null) {
    return await profitEngine.getOverallProfitStats(startDate, endDate);
  }

  /**
   * Preview result calculation without declaring
   */
  async previewResultCalculation(gameRoundId) {
    const calculation = await profitEngine.calculateAllResultsLiability(gameRoundId);
    
    if (!calculation) {
      return { message: 'No bets placed yet', results: [] };
    }

    // Get recommended result (highest profit)
    const recommended = calculation.results[0];

    return {
      totalCollection: calculation.totalCollection,
      totalBets: calculation.totalBets,
      recommended: {
        number: recommended.number,
        color: recommended.color,
        size: recommended.size,
        profit: recommended.profit,
        profitPercent: recommended.profitPercent,
      },
      allResults: calculation.results.map(r => ({
        number: r.number,
        color: r.color,
        size: r.size,
        profit: r.profit,
        profitPercent: r.profitPercent,
        isProfitable: r.isProfitable,
      })),
    };
  }
}

module.exports = new GameAdminService();
