const express = require('express');
const router = express.Router();
const riskDashboardController = require('../controllers/riskDashboard.controller');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * @route   GET /api/admin/risk/summary
 * @desc    Get real-time risk summary
 * @access  Private (Admin)
 */
router.get('/summary', authenticateAdmin, riskDashboardController.getSummary);

/**
 * @route   GET /api/admin/risk/analysis/:gameRoundId
 * @desc    Get detailed risk analysis for a round
 * @access  Private (Admin)
 */
router.get('/analysis/:gameRoundId', authenticateAdmin, riskDashboardController.getRoundAnalysis);

/**
 * @route   GET /api/admin/risk/distribution/:gameRoundId
 * @desc    Get bet distribution for a round
 * @access  Private (Admin)
 */
router.get('/distribution/:gameRoundId', authenticateAdmin, riskDashboardController.getBetDistribution);

/**
 * @route   GET /api/admin/risk/user-bets/:gameRoundId
 * @desc    Get user-wise bet history for a round
 * @access  Private (Admin)
 */
router.get('/user-bets/:gameRoundId', authenticateAdmin, riskDashboardController.getUserBets);

/**
 * @route   GET /api/admin/risk/payouts/:gameRoundId
 * @desc    Get payout calculations for all possible results
 * @access  Private (Admin)
 */
router.get('/payouts/:gameRoundId', authenticateAdmin, riskDashboardController.getPayoutCalculations);

/**
 * @route   GET /api/admin/risk/history
 * @desc    Get historical risk statistics
 * @access  Private (Admin)
 */
router.get('/history', authenticateAdmin, riskDashboardController.getHistoricalStats);

module.exports = router;
