const gameService = require('../services/game.service');
const { success, error, paginated } = require('../utils/response');

/**
 * Game Controller - Handles game requests
 */
class GameController {
  /**
   * Get current active game round
   */
  async getCurrentRound(req, res) {
    try {
      const gameRound = await gameService.getCurrentRound();
      return success(res, gameRound, 'Current game round retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get game history
   */
  async getGameHistory(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await gameService.getGameHistory(page, limit);
      return paginated(res, result.gameRounds, page, limit, result.total, 'Game history retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get all game rounds (admin only)
   */
  async getAllRounds(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await gameService.getAllRounds(page, limit);
      return paginated(res, result.gameRounds, page, limit, result.total, 'Game rounds retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new GameController();
