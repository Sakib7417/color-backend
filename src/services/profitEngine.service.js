const prisma = require('../config/database');
const { PAYOUTS, NUMBER_COLORS, NUMBER_SIZES } = require('../config/constants');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Profit Engine Service - Calculates optimal game results based on profit maximization
 */
class ProfitEngineService {
  constructor() {
    // Configurable safety limits (can be moved to database settings)
    this.MIN_PROFIT_PERCENT = parseFloat(env.MIN_PROFIT_PERCENT || 5); // Minimum 5% profit
    this.MAX_LOSS_PER_ROUND = parseFloat(env.MAX_LOSS_PER_ROUND || 0); // 0 = no loss allowed
    this.HIGH_PROFIT_WEIGHT = 0.70; // 70% chance
    this.MEDIUM_PROFIT_WEIGHT = 0.20; // 20% chance
    this.RANDOM_WEIGHT = 0.10; // 10% chance
  }

  /**
   * Calculate liability for all possible results (0-9)
   */
  async calculateAllResultsLiability(gameRoundId) {
    // Get all bets for this round
    const bets = await prisma.bet.findMany({
      where: { gameRoundId },
    });

    if (bets.length === 0) {
      return null; // No bets placed
    }

    // Calculate total collection
    const totalCollection = bets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);

    // Calculate liability for each possible result (0-9)
    const results = [];

    for (let number = 0; number <= 9; number++) {
      const color = NUMBER_COLORS[number];
      const size = NUMBER_SIZES[number];

      // Calculate payouts for this result
      let colorPayout = 0;
      let sizePayout = 0;
      let numberPayout = 0;

      for (const bet of bets) {
        if (bet.betType === 'COLOR') {
          // Check if this color wins
          if (bet.selection === color) {
            const multiplier = color === 'VIOLET' ? PAYOUTS.COLOR.VIOLET : PAYOUTS.COLOR[color];
            colorPayout += parseFloat(bet.amount) * multiplier;
          } else if (bet.selection === 'VIOLET' && (number === 0 || number === 5)) {
            // Violet bets win on 0 and 5
            colorPayout += parseFloat(bet.amount) * PAYOUTS.COLOR.VIOLET;
          }
        } else if (bet.betType === 'SIZE') {
          // Check if this size wins
          if (bet.selection === size) {
            sizePayout += parseFloat(bet.amount) * PAYOUTS.SIZE[size];
          }
        } else if (bet.betType === 'NUMBER') {
          // Check if this number wins
          if (parseInt(bet.selection) === number) {
            numberPayout += parseFloat(bet.amount) * PAYOUTS.NUMBER;
          }
        }
      }

      // Total liability for this result
      const totalLiability = colorPayout + sizePayout + numberPayout;
      const profit = totalCollection - totalLiability;
      const profitPercent = totalCollection > 0 ? (profit / totalCollection) * 100 : 0;

      results.push({
        number,
        color,
        size,
        colorPayout,
        sizePayout,
        numberPayout,
        totalLiability,
        totalCollection,
        profit,
        profitPercent,
        isProfitable: profit >= 0 && profitPercent >= this.MIN_PROFIT_PERCENT,
        isAcceptable: profit >= -this.MAX_LOSS_PER_ROUND,
      });
    }

    return {
      gameRoundId,
      totalCollection,
      totalBets: bets.length,
      results: results.sort((a, b) => b.profit - a.profit), // Sort by profit (highest first)
    };
  }

  /**
   * Select result based on weighted probability
   * 70% - Highest profit
   * 20% - Medium profit
   * 10% - Random valid result
   */
  selectWeightedResult(calculatedResults) {
    const { results } = calculatedResults;

    // Filter only acceptable results (within loss limit)
    const acceptableResults = results.filter(r => r.isAcceptable);

    if (acceptableResults.length === 0) {
      // No acceptable results - force least loss
      logger.warn('No profitable results found! Selecting least loss option.');
      return results[0]; // Already sorted by profit (highest first = least loss)
    }

    // Categorize results
    const profitableResults = acceptableResults.filter(r => r.isProfitable);
    const highProfit = profitableResults[0]; // Highest profit
    const mediumProfit = profitableResults[Math.floor(profitableResults.length / 2)] || highProfit;
    
    // Random valid result from acceptable
    const randomResult = acceptableResults[Math.floor(Math.random() * acceptableResults.length)];

    // Weighted random selection
    const random = Math.random();
    let selected;
    let selectedRank;

    if (random < this.HIGH_PROFIT_WEIGHT) {
      // 70% - Highest profit
      selected = highProfit;
      selectedRank = 'HIGH_PROFIT';
    } else if (random < this.HIGH_PROFIT_WEIGHT + this.MEDIUM_PROFIT_WEIGHT) {
      // 20% - Medium profit
      selected = mediumProfit;
      selectedRank = 'MEDIUM_PROFIT';
    } else {
      // 10% - Random
      selected = randomResult;
      selectedRank = 'RANDOM';
    }

    return {
      ...selected,
      selectedRank,
      allResults: results,
    };
  }

  /**
   * Calculate and select optimal result
   */
  async calculateOptimalResult(gameRoundId) {
    // Step 1: Calculate liability for all possible results
    const calculation = await this.calculateAllResultsLiability(gameRoundId);

    if (!calculation) {
      // No bets - return random result
      const randomNumber = Math.floor(Math.random() * 10);
      return {
        number: randomNumber,
        color: NUMBER_COLORS[randomNumber],
        size: NUMBER_SIZES[randomNumber],
        totalCollection: 0,
        totalLiability: 0,
        profit: 0,
        profitPercent: 0,
        selectedRank: 'RANDOM_NO_BETS',
        isProfitable: true,
      };
    }

    // Step 2: Select result based on weighted probability
    const selected = this.selectWeightedResult(calculation);

    logger.info(`[Profit Engine] Round ${gameRoundId}: Selected ${selected.number} (${selected.color}, ${selected.size}) with profit ${selected.profit.toFixed(2)} (${selected.profitPercent.toFixed(2)}%) - ${selected.selectedRank}`);

    return selected;
  }

  /**
   * Validate if admin-declared result is acceptable
   */
  async validateAdminResult(gameRoundId, winningOption) {
    const calculation = await this.calculateAllResultsLiability(gameRoundId);

    if (!calculation) {
      return { valid: true, warning: 'No bets placed' };
    }

    // Parse winning option to number
    let targetNumber = null;
    if (/^[0-9]$/.test(winningOption)) {
      targetNumber = parseInt(winningOption);
    } else if (['GREEN', 'RED', 'VIOLET'].includes(winningOption.toUpperCase())) {
      // Find first number with this color
      targetNumber = parseInt(Object.entries(NUMBER_COLORS)
        .find(([num, color]) => color === winningOption.toUpperCase())?.[0] || 0);
    } else if (['BIG', 'SMALL'].includes(winningOption.toUpperCase())) {
      // Find first number with this size
      targetNumber = parseInt(Object.entries(NUMBER_SIZES)
        .find(([num, size]) => size === winningOption.toUpperCase())?.[0] || 0);
    }

    if (targetNumber === null) {
      return { valid: false, error: 'Invalid winning option' };
    }

    const result = calculation.results.find(r => r.number === targetNumber);

    if (!result.isAcceptable) {
      return {
        valid: false,
        error: `Result causes loss of ${Math.abs(result.profit).toFixed(2)} which exceeds max allowed loss of ${this.MAX_LOSS_PER_ROUND}`,
        result,
      };
    }

    if (!result.isProfitable) {
      return {
        valid: true,
        warning: `Result is not profitable (profit: ${result.profitPercent.toFixed(2)}%). Minimum required: ${this.MIN_PROFIT_PERCENT}%`,
        result,
      };
    }

    return { valid: true, result };
  }

  /**
   * Store calculation data to database
   */
  async storeCalculationData(gameRoundId, selectedResult, allCalculations) {
    try {
      await prisma.gameRound.update({
        where: { id: gameRoundId },
        data: {
          totalCollection: selectedResult.totalCollection,
          totalPayout: selectedResult.totalLiability,
          profit: selectedResult.profit,
          profitPercent: selectedResult.profitPercent,
          calculationData: allCalculations ? JSON.stringify(allCalculations.results) : null,
          selectedResultRank: selectedResult.selectedRank,
          isProfitable: selectedResult.isProfitable,
          lossAmount: selectedResult.profit < 0 ? Math.abs(selectedResult.profit) : null,
        },
      });
    } catch (err) {
      logger.error('Error storing calculation data:', err);
    }
  }

  /**
   * Get profit statistics for a round
   */
  async getRoundProfitStats(gameRoundId) {
    const round = await prisma.gameRound.findUnique({
      where: { id: gameRoundId },
      select: {
        totalCollection: true,
        totalPayout: true,
        profit: true,
        profitPercent: true,
        isProfitable: true,
        lossAmount: true,
        calculationData: true,
      },
    });

    if (!round) {
      throw new Error('Round not found');
    }

    return {
      ...round,
      calculationData: round.calculationData ? JSON.parse(round.calculationData) : null,
    };
  }

  /**
   * Get overall profit statistics
   */
  async getOverallProfitStats(startDate = null, endDate = null) {
    const where = {
      resultStatus: 'DECLARED',
    };

    if (startDate || endDate) {
      where.declaredAt = {};
      if (startDate) where.declaredAt.gte = new Date(startDate);
      if (endDate) where.declaredAt.lte = new Date(endDate);
    }

    const stats = await prisma.gameRound.aggregate({
      where,
      _sum: {
        totalCollection: true,
        totalPayout: true,
        profit: true,
      },
      _count: {
        id: true,
      },
    });

    const profitableRounds = await prisma.gameRound.count({
      where: { ...where, isProfitable: true },
    });

    const lossRounds = await prisma.gameRound.count({
      where: { ...where, isProfitable: false },
    });

    return {
      totalRounds: stats._count.id,
      totalCollection: stats._sum.totalCollection || 0,
      totalPayout: stats._sum.totalPayout || 0,
      totalProfit: stats._sum.profit || 0,
      profitableRounds,
      lossRounds,
      averageProfitPercent: stats._sum.totalCollection > 0 
        ? ((stats._sum.profit || 0) / stats._sum.totalCollection) * 100 
        : 0,
    };
  }
}

module.exports = new ProfitEngineService();
