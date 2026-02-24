const riskDashboardService = require('../services/riskDashboard.service');
const { success, error } = require('../utils/response');

/**
 * Risk Dashboard Controller - Handles admin risk dashboard requests
 */
class RiskDashboardController {
  /**
   * Get real-time summary for dashboard
   * GET /api/admin/risk/summary
   */
  async getSummary(req, res) {
    try {
      const summary = await riskDashboardService.getRealtimeSummary();
      return success(res, summary, 'Risk summary retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get detailed risk analysis for a round
   * GET /api/admin/risk/analysis/:gameRoundId
   */
  async getRoundAnalysis(req, res) {
    try {
      const { gameRoundId } = req.params;

      if (!gameRoundId) {
        return error(res, 'gameRoundId is required', 400);
      }

      const analysis = await riskDashboardService.getRoundRiskAnalysis(gameRoundId);
      return success(res, analysis, 'Round risk analysis retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  /**
   * Get bet distribution for a round
   * GET /api/admin/risk/distribution/:gameRoundId
   */
  async getBetDistribution(req, res) {
    try {
      const { gameRoundId } = req.params;

      if (!gameRoundId) {
        return error(res, 'gameRoundId is required', 400);
      }

      const analysis = await riskDashboardService.getRoundRiskAnalysis(gameRoundId);
      
      return success(res, {
        round: analysis.round,
        distribution: analysis.betDistribution,
        summary: {
          topColor: this.getTopOption(analysis.betDistribution.colors),
          topSize: this.getTopOption(analysis.betDistribution.sizes),
          topNumber: this.getTopNumber(analysis.betDistribution.numbers),
        },
      }, 'Bet distribution retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  /**
   * Get user-wise bet history for a round
   * GET /api/admin/risk/user-bets/:gameRoundId
   */
  async getUserBets(req, res) {
    try {
      const { gameRoundId } = req.params;

      if (!gameRoundId) {
        return error(res, 'gameRoundId is required', 400);
      }

      const analysis = await riskDashboardService.getRoundRiskAnalysis(gameRoundId);
      
      // Group bets by user
      const userMap = new Map();
      
      for (const bet of analysis.userBets) {
        if (!userMap.has(bet.userId)) {
          userMap.set(bet.userId, {
            userId: bet.userId,
            userMobile: bet.userMobile,
            userName: bet.userName,
            totalBets: 0,
            totalAmount: 0,
            bets: [],
          });
        }
        
        const user = userMap.get(bet.userId);
        user.totalBets += 1;
        user.totalAmount += bet.amount;
        user.bets.push({
          id: bet.id,
          betType: bet.betType,
          selection: bet.selection,
          amount: bet.amount,
          potentialWin: bet.potentialWin,
          createdAt: bet.createdAt,
        });
      }

      return success(res, {
        round: analysis.round,
        users: Array.from(userMap.values()),
        totalUsers: userMap.size,
      }, 'User bets retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  /**
   * Get payout calculation for all possible results
   * GET /api/admin/risk/payouts/:gameRoundId
   */
  async getPayoutCalculations(req, res) {
    try {
      const { gameRoundId } = req.params;

      if (!gameRoundId) {
        return error(res, 'gameRoundId is required', 400);
      }

      const analysis = await riskDashboardService.getRoundRiskAnalysis(gameRoundId);
      
      return success(res, {
        round: analysis.round,
        totalCollection: analysis.betDistribution.totalAmount,
        results: analysis.resultAnalysis.map(r => ({
          number: r.number,
          color: r.color,
          size: r.size,
          payouts: {
            color: r.colorPayout,
            size: r.sizePayout,
            number: r.numberPayout,
            total: r.totalPayout,
          },
          profit: r.profit,
          profitPercent: r.profitPercent,
          riskLevel: r.riskLevel,
          winningBetsCount: r.winningBetsCount,
        })),
        recommended: analysis.recommendedResult,
        riskIndicators: analysis.riskIndicators,
      }, 'Payout calculations retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  /**
   * Get historical risk statistics
   * GET /api/admin/risk/history
   */
  async getHistoricalStats(req, res) {
    try {
      const days = parseInt(req.query.days) || 7;
      
      const stats = await riskDashboardService.getHistoricalStats(days);
      return success(res, stats, 'Historical statistics retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get top option helper
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
   * Get top number helper
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
}

module.exports = new RiskDashboardController();
