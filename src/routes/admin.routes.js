const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const gameAdminController = require('../controllers/gameAdmin.controller');
const { authenticateAdmin, requireSuperAdmin } = require('../middleware/auth');
const { validatePagination, validateDepositAction, validateWithdrawalAction } = require('../middleware/validation');

/**
 * @route   GET /api/admin/profile
 * @desc    Get admin profile
 * @access  Private (Admin)
 */
router.get('/profile', authenticateAdmin, adminController.getProfile);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard stats
 * @access  Private (Admin)
 */
router.get('/dashboard', authenticateAdmin, adminController.getDashboardStats);

// User Management
/**
 * @route   GET /api/admin/users
 * @desc    Get all users
 * @access  Private (Admin)
 */
router.get('/users', authenticateAdmin, validatePagination, adminController.getUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get user details
 * @access  Private (Admin)
 */
router.get('/users/:id', authenticateAdmin, adminController.getUserDetails);

/**
 * @route   PATCH /api/admin/users/:id/status
 * @desc    Update user status
 * @access  Private (Admin)
 */
router.patch('/users/:id/status', authenticateAdmin, adminController.updateUserStatus);

// Deposit Management
/**
 * @route   GET /api/admin/deposits
 * @desc    Get all deposits
 * @access  Private (Admin)
 */
router.get('/deposits', authenticateAdmin, validatePagination, adminController.getDeposits);

/**
 * @route   POST /api/admin/deposits/:id/process
 * @desc    Process a deposit
 * @access  Private (Admin)
 */
router.post('/deposits/:id/process', authenticateAdmin, validateDepositAction, adminController.processDeposit);

// Withdrawal Management
/**
 * @route   GET /api/admin/withdrawals
 * @desc    Get all withdrawals
 * @access  Private (Admin)
 */
router.get('/withdrawals', authenticateAdmin, validatePagination, adminController.getWithdrawals);

/**
 * @route   POST /api/admin/withdrawals/:id/process
 * @desc    Process a withdrawal
 * @access  Private (Admin)
 */
router.post('/withdrawals/:id/process', authenticateAdmin, validateWithdrawalAction, adminController.processWithdrawal);

// Settings Management
/**
 * @route   GET /api/admin/settings
 * @desc    Get all settings
 * @access  Private (Admin)
 */
router.get('/settings', authenticateAdmin, adminController.getSettings);

/**
 * @route   PATCH /api/admin/settings/:key
 * @desc    Update a setting
 * @access  Private (Admin)
 */
router.patch('/settings/:key', authenticateAdmin, adminController.updateSetting);

/**
 * @route   PUT /api/admin/upi-id
 * @desc    Update admin UPI ID
 * @access  Private (Admin)
 */
router.put('/upi-id', authenticateAdmin, adminController.updateUpiId);

// Admin Management (Super Admin Only)
/**
 * @route   POST /api/admin/create
 * @desc    Create a new admin
 * @access  Private (Super Admin)
 */
router.post('/create', authenticateAdmin, requireSuperAdmin, adminController.createAdmin);

/**
 * @route   GET /api/admin/list
 * @desc    Get all admins
 * @access  Private (Super Admin)
 */
router.get('/list', authenticateAdmin, requireSuperAdmin, adminController.getAdmins);

// ==================== GAME CONTROL APIs ====================

/**
 * @route   POST /api/admin/game/declare-result
 * @desc    Declare winning result for a round
 * @access  Private (Admin)
 */
router.post('/game/declare-result', authenticateAdmin, gameAdminController.declareResult);

/**
 * @route   PATCH /api/admin/game/round-status
 * @desc    Update round status (OPEN, PAUSED, CLOSED)
 * @access  Private (Admin)
 */
router.patch('/game/round-status', authenticateAdmin, gameAdminController.updateRoundStatus);

/**
 * @route   POST /api/admin/game/cancel-round
 * @desc    Cancel round and refund all bets
 * @access  Private (Admin)
 */
router.post('/game/cancel-round', authenticateAdmin, gameAdminController.cancelRound);

/**
 * @route   GET /api/admin/game/rounds
 * @desc    Get all rounds with filtering
 * @access  Private (Admin)
 */
router.get('/game/rounds', authenticateAdmin, validatePagination, gameAdminController.getRounds);

/**
 * @route   GET /api/admin/game/rounds/:id
 * @desc    Get round details with bets
 * @access  Private (Admin)
 */
router.get('/game/rounds/:id', authenticateAdmin, gameAdminController.getRoundDetails);

/**
 * @route   POST /api/admin/game/auto-result
 * @desc    Trigger auto-calculate result (for testing)
 * @access  Private (Admin)
 */
router.post('/game/auto-result', authenticateAdmin, gameAdminController.autoCalculateResult);

/**
 * @route   GET /api/admin/game/preview-result/:gameRoundId
 * @desc    Preview result calculation without declaring
 * @access  Private (Admin)
 */
router.get('/game/preview-result/:gameRoundId', authenticateAdmin, gameAdminController.previewResult);

/**
 * @route   GET /api/admin/game/profit-stats
 * @desc    Get profit statistics
 * @access  Private (Admin)
 */
router.get('/game/profit-stats', authenticateAdmin, gameAdminController.getProfitStats);

module.exports = router;
