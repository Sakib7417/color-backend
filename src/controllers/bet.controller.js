const betService = require('../services/bet.service');
const { success, error, paginated } = require('../utils/response');

/**
 * Bet Controller - Handles betting requests
 */
class BetController {
  /**
   * Place a bet
   */
  async placeBet(req, res) {
    try {
      const bet = await betService.placeBet(req.user.id, req.body);
      return success(res, bet, 'Bet placed successfully', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Get user's bet history
   */
  async getUserBets(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await betService.getUserBets(req.user.id, page, limit);
      return paginated(res, result.bets, page, limit, result.total, 'Bet history retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get bets for a specific game round
   */
  async getRoundBets(req, res) {
    try {
      const { gameRoundId } = req.params;
      const bets = await betService.getRoundBets(req.user.id, gameRoundId);
      return success(res, bets, 'Bets retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get all bets (admin only)
   */
  async getAllBets(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await betService.getAllBets(page, limit);
      return paginated(res, result.bets, page, limit, result.total, 'Bets retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new BetController();
