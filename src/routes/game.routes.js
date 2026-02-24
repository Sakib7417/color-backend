const express = require('express');
const router = express.Router();
const gameController = require('../controllers/game.controller');
const betController = require('../controllers/bet.controller');
const { authenticate, authenticateAdmin } = require('../middleware/auth');
const { validateBet, validatePagination } = require('../middleware/validation');

// Game routes
/**
 * @route   GET /api/game/current
 * @desc    Get current active game round
 * @access  Private
 */
router.get('/current', authenticate, gameController.getCurrentRound);

/**
 * @route   GET /api/game/history
 * @desc    Get game history
 * @access  Private
 */
router.get('/history', authenticate, validatePagination, gameController.getGameHistory);

/**
 * @route   GET /api/game/rounds
 * @desc    Get all game rounds (admin)
 * @access  Private (Admin)
 */
router.get('/rounds', authenticateAdmin, validatePagination, gameController.getAllRounds);

// Bet routes
/**
 * @route   POST /api/game/bet
 * @desc    Place a bet
 * @access  Private
 */
router.post('/bet', authenticate, validateBet, betController.placeBet);

/**
 * @route   GET /api/game/bets
 * @desc    Get user's bet history
 * @access  Private
 */
router.get('/bets', authenticate, validatePagination, betController.getUserBets);

/**
 * @route   GET /api/game/bets/:gameRoundId
 * @desc    Get bets for a specific game round
 * @access  Private
 */
router.get('/bets/:gameRoundId', authenticate, betController.getRoundBets);

/**
 * @route   GET /api/game/all-bets
 * @desc    Get all bets (admin)
 * @access  Private (Admin)
 */
router.get('/all-bets', authenticateAdmin, validatePagination, betController.getAllBets);

module.exports = router;
