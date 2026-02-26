const prisma = require('../config/database');
const { PAYOUTS, NUMBER_COLORS, NUMBER_SIZES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Risk Dashboard Service - Calculates real-time risk metrics for admin dashboard
 */
class RiskDashboardService {
  /**
   * Get complete risk analysis for a game round
   */
  async getRoundRiskAnalysis(gameRoundId) {
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

    // Calculate bet distribution
    const betDistribution = this.calculateBetDistribution(round.bets);

    // Calculate payout for each possible result (0-9)
    const resultAnalysis = this.calculateResultAnalysis(round.bets, betDistribution.totalAmount);

    // Determine risk levels
    const riskIndicators = this.calculateRiskIndicators(resultAnalysis);

    // Get recommended result
    const recommendedResult = this.getRecommendedResult(resultAnalysis);

    return {
      round: {
        id: round.id,
        period: round.period,
        status: round.status,
        resultStatus: round.resultStatus,
        startTime: round.startTime,
        endTime: round.endTime,
        totalBets: round.bets.length,
      },
      betDistribution,
      userBets: round.bets.map(bet => ({
        id: bet.id,
        userId: bet.userId,
        userMobile: bet.user.mobileNumber,
        userName: bet.user.name,
        betType: bet.betType,
        selection: bet.selection,
        amount: parseFloat(bet.amount),
        potentialWin: parseFloat(bet.potentialWin),
        createdAt: bet.createdAt,
      })),
      resultAnalysis,
      riskIndicators,
      recommendedResult,
    };
  }

  /**
   * Calculate bet distribution by option
   */
  calculateBetDistribution(bets) {
    const distribution = {
      colors: { GREEN: 0, RED: 0, VIOLET: 0 },
      sizes: { BIG: 0, SMALL: 0 },
      numbers: {},
      totalAmount: 0,
      totalBets: bets.length,
    };

    // Initialize numbers
    for (let i = 0; i <= 9; i++) {
      distribution.numbers[i] = 0;
    }

    for (const bet of bets) {
      const amount = parseFloat(bet.amount);
      distribution.totalAmount += amount;

      if (bet.betType === 'COLOR') {
        distribution.colors[bet.selection] += amount;
      } else if (bet.betType === 'SIZE') {
        distribution.sizes[bet.selection] += amount;
      } else if (bet.betType === 'NUMBER') {
        distribution.numbers[bet.selection] += amount;
      }
    }

    return distribution;
  }

  /**
   * Calculate payout and profit for each possible result (0-9)
   */
  calculateResultAnalysis(bets, totalCollection) {
    const results = [];

    for (let number = 0; number <= 9; number++) {
      const color = NUMBER_COLORS[number];
      const size = NUMBER_SIZES[number];

      let colorPayout = 0;
      let sizePayout = 0;
      let numberPayout = 0;

      const winningBets = [];

      for (const bet of bets) {
        let isWin = false;
        let winAmount = 0;

        if (bet.betType === 'COLOR') {
          if (bet.selection === color) {
            isWin = true;
            // Special case: if winning number is 0 or 5 (dual-color), use reduced payout for GREEN/RED
            if ((number === 0 && bet.selection === 'GREEN') || (number === 5 && bet.selection === 'RED')) {
              winAmount = parseFloat(bet.amount) * 1.45; // 45% return
            } else {
              const multiplier = color === 'VIOLET' ? PAYOUTS.COLOR.VIOLET : PAYOUTS.COLOR[color];
              winAmount = parseFloat(bet.amount) * multiplier;
            }
            colorPayout += winAmount;
          } else if (bet.selection === 'VIOLET' && (number === 0 || number === 5)) {
            isWin = true;
            winAmount = parseFloat(bet.amount) * PAYOUTS.COLOR.VIOLET;
            colorPayout += winAmount;
          }
        } else if (bet.betType === 'SIZE') {
          if (bet.selection === size) {
            isWin = true;
            winAmount = parseFloat(bet.amount) * PAYOUTS.SIZE[size];
            sizePayout += winAmount;
          }
        } else if (bet.betType === 'NUMBER') {
          if (parseInt(bet.selection) === number) {
            isWin = true;
            winAmount = parseFloat(bet.amount) * PAYOUTS.NUMBER;
            numberPayout += winAmount;
          }
        }

        if (isWin) {
          winningBets.push({
            betId: bet.id,
            userId: bet.userId,
            betType: bet.betType,
            selection: bet.selection,
            amount: parseFloat(bet.amount),
            winAmount,
          });
        }
      }

      const totalPayout = colorPayout + sizePayout + numberPayout;
      const profit = totalCollection - totalPayout;
      const profitPercent = totalCollection > 0 ? (profit / totalCollection) * 100 : 0;

      // Determine risk level
      let riskLevel = 'SAFE';
      if (profitPercent < 0) {
        riskLevel = 'HIGH_LOSS';
      } else if (profitPercent < 10) {
        riskLevel = 'MEDIUM_RISK';
      } else if (profitPercent >= 20) {
        riskLevel = 'SAFE_PROFIT';
      }

      // Check if this is a dual-color number
      const isDualColor = (number === 0 || number === 5);
      const dualColorInfo = isDualColor ? {
        number,
        dualColors: number === 0 ? ['GREEN', 'VIOLET'] : ['RED', 'VIOLET'],
        specialPayoutRule: true,
        affectedColors: number === 0 ? ['GREEN'] : ['RED'],
      } : null;

      results.push({
        number,
        color,
        size,
        colorPayout,
        sizePayout,
        numberPayout,
        totalPayout,
        totalCollection,
        profit,
        profitPercent,
        riskLevel,
        isDualColor,
        dualColorInfo,
        winningBetsCount: winningBets.length,
        winningBets,
      });
    }

    // Sort by profit (highest first)
    return results.sort((a, b) => b.profit - a.profit);
  }

  /**
   * Calculate risk indicators
   */
  calculateRiskIndicators(resultAnalysis) {
    const safeProfits = resultAnalysis.filter(r => r.riskLevel === 'SAFE_PROFIT');
    const mediumRisks = resultAnalysis.filter(r => r.riskLevel === 'MEDIUM_RISK');
    const highLosses = resultAnalysis.filter(r => r.riskLevel === 'HIGH_LOSS');

    const maxProfit = Math.max(...resultAnalysis.map(r => r.profit));
    const maxLoss = Math.min(...resultAnalysis.map(r => r.profit));
    const avgProfit = resultAnalysis.reduce((sum, r) => sum + r.profit, 0) / resultAnalysis.length;

    return {
      safeProfitCount: safeProfits.length,
      mediumRiskCount: mediumRisks.length,
      highLossCount: highLosses.length,
      maxProfit,
      maxLoss,
      avgProfit,
      overallRisk: highLosses.length > 5 ? 'HIGH' : highLosses.length > 2 ? 'MEDIUM' : 'LOW',
    };
  }

  /**
   * Get recommended result based on lowest payout
   */
  getRecommendedResult(resultAnalysis) {
    // Get the result with highest profit (lowest payout)
    const bestResult = resultAnalysis[0];
    
    // Get alternative options (2nd and 3rd best)
    const alternatives = resultAnalysis.slice(1, 4);

    return {
      recommended: {
        number: bestResult.number,
        color: bestResult.color,
        size: bestResult.size,
        profit: bestResult.profit,
        profitPercent: bestResult.profitPercent,
        riskLevel: bestResult.riskLevel,
      },
      alternatives: alternatives.map(r => ({
        number: r.number,
        color: r.color,
        size: r.size,
        profit: r.profit,
        profitPercent: r.profitPercent,
        riskLevel: r.riskLevel,
      })),
    };
  }

  /**
   * Get real-time summary for dashboard
   */
  async getRealtimeSummary() {
    const currentRound = await prisma.gameRound.findFirst({
      where: {
        status: { in: ['OPEN', 'PAUSED'] },
        resultStatus: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentRound) {
      return { message: 'No active round', round: null };
    }

    const analysis = await this.getRoundRiskAnalysis(currentRound.id);

    return {
      round: analysis.round,
      summary: {
        totalBets: analysis.betDistribution.totalBets,
        totalAmount: analysis.betDistribution.totalAmount,
        topColor: this.getTopOption(analysis.betDistribution.colors),
        topSize: this.getTopOption(analysis.betDistribution.sizes),
        topNumber: this.getTopNumber(analysis.betDistribution.numbers),
      },
      riskStatus: analysis.riskIndicators,
      recommended: analysis.recommendedResult.recommended,
    };
  }

  /**
   * Get top option from distribution
   */
  getTopOption(distribution) {
    let topOption = null;
    let topAmount = 0;

    for (const [option, amount] of Object.entries(distribution)) {
      if (amount > topAmount) {
        topAmount = amount;
        topOption = option;
      }
    }

    return { option: topOption, amount: topAmount };
  }

  /**
   * Get top number from distribution
   */
  getTopNumber(numbers) {
    let topNumber = null;
    let topAmount = 0;

    for (const [number, amount] of Object.entries(numbers)) {
      if (amount > topAmount) {
        topAmount = amount;
        topNumber = number;
      }
    }

    return { number: topNumber, amount: topAmount };
  }

  /**
   * Get historical risk statistics
   */
  async getHistoricalStats(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rounds = await prisma.gameRound.findMany({
      where: {
        resultStatus: 'DECLARED',
        declaredAt: { gte: startDate },
      },
      select: {
        totalCollection: true,
        totalPayout: true,
        profit: true,
        profitPercent: true,
        isProfitable: true,
        resultDeclaredBy: true,
      },
    });

    const totalRounds = rounds.length;
    const profitableRounds = rounds.filter(r => r.isProfitable).length;
    const lossRounds = totalRounds - profitableRounds;

    const totalCollection = rounds.reduce((sum, r) => sum + (parseFloat(r.totalCollection) || 0), 0);
    const totalPayout = rounds.reduce((sum, r) => sum + (parseFloat(r.totalPayout) || 0), 0);
    const totalProfit = rounds.reduce((sum, r) => sum + (parseFloat(r.profit) || 0), 0);

    const adminDeclared = rounds.filter(r => r.resultDeclaredBy === 'ADMIN').length;
    const systemDeclared = rounds.filter(r => r.resultDeclaredBy === 'SYSTEM').length;

    return {
      period: `${days} days`,
      totalRounds,
      profitableRounds,
      lossRounds,
      totalCollection,
      totalPayout,
      totalProfit,
      avgProfitPerRound: totalRounds > 0 ? totalProfit / totalRounds : 0,
      profitMargin: totalCollection > 0 ? (totalProfit / totalCollection) * 100 : 0,
      adminDeclared,
      systemDeclared,
    };
  }
}

module.exports = new RiskDashboardService();
