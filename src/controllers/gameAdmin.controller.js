const gameAdminService = require('../services/gameAdmin.service');
const { success, error, paginated } = require('../utils/response');

/**
 * Game Admin Controller - Handles admin game control requests
 */
class GameAdminController {
  /**
   * Declare winning result for a round
   * POST /api/admin/game/declare-result
   */
  async declareResult(req, res) {
    try {
      const { gameRoundId, winningOption } = req.body;

      if (!gameRoundId || !winningOption) {
        return error(res, 'gameRoundId and winningOption are required', 400);
      }

      const result = await gameAdminService.declareResult(
        gameRoundId,
        winningOption,
        req.admin.id
      );

      return success(res, result, 'Result declared successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Update round status (OPEN, PAUSED, CLOSED)
   * PATCH /api/admin/game/round-status
   */
  async updateRoundStatus(req, res) {
    try {
      const { gameRoundId, status } = req.body;

      if (!gameRoundId || !status) {
        return error(res, 'gameRoundId and status are required', 400);
      }

      const result = await gameAdminService.updateRoundStatus(gameRoundId, status);
      return success(res, result, 'Round status updated successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Cancel round and refund all bets
   * POST /api/admin/game/cancel-round
   */
  async cancelRound(req, res) {
    try {
      const { gameRoundId } = req.body;

      if (!gameRoundId) {
        return error(res, 'gameRoundId is required', 400);
      }

      const result = await gameAdminService.cancelRound(gameRoundId, req.admin.id);
      return success(res, result, 'Round cancelled successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Get all rounds with filtering
   * GET /api/admin/game/rounds
   */
  async getRounds(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || null;

      const result = await gameAdminService.getRounds(page, limit, status);
      return paginated(res, result.rounds, page, limit, result.total, 'Rounds retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get round details with bets
   * GET /api/admin/game/rounds/:id
   */
  async getRoundDetails(req, res) {
    try {
      const { id } = req.params;

      const result = await gameAdminService.getRoundDetails(id);
      return success(res, result, 'Round details retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  /**
   * Trigger auto-calculate result (for testing or manual system result)
   * POST /api/admin/game/auto-result
   */
  async autoCalculateResult(req, res) {
    try {
      const { gameRoundId } = req.body;

      if (!gameRoundId) {
        return error(res, 'gameRoundId is required', 400);
      }

      const result = await gameAdminService.autoCalculateResult(gameRoundId);
      return success(res, result, 'Auto result calculated successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Preview result calculation without declaring
   * GET /api/admin/game/preview-result/:gameRoundId
   */
  async previewResult(req, res) {
    try {
      const { gameRoundId } = req.params;

      if (!gameRoundId) {
        return error(res, 'gameRoundId is required', 400);
      }

      const result = await gameAdminService.previewResultCalculation(gameRoundId);
      return success(res, result, 'Result preview calculated successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Get profit statistics
   * GET /api/admin/game/profit-stats
   */
  async getProfitStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const result = await gameAdminService.getProfitStats(startDate, endDate);
      return success(res, result, 'Profit statistics retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new GameAdminController();
