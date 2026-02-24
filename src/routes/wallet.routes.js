const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const { authenticate } = require('../middleware/auth');
const { validateDeposit, validateWithdrawal, validateBankDetails, validatePagination } = require('../middleware/validation');

/**
 * @route   GET /api/wallet
 * @desc    Get user wallet balance
 * @access  Private
 */
router.get('/', authenticate, walletController.getWallet);

/**
 * @route   GET /api/wallet/transactions
 * @desc    Get user transaction history
 * @access  Private
 */
router.get('/transactions', authenticate, validatePagination, walletController.getTransactions);

/**
 * @route   POST /api/wallet/deposit
 * @desc    Request a deposit
 * @access  Private
 */
router.post('/deposit', authenticate, validateDeposit, walletController.createDeposit);

/**
 * @route   GET /api/wallet/deposits
 * @desc    Get user deposit history
 * @access  Private
 */
router.get('/deposits', authenticate, validatePagination, walletController.getDeposits);

/**
 * @route   POST /api/wallet/withdraw
 * @desc    Request a withdrawal
 * @access  Private
 */
router.post('/withdraw', authenticate, validateWithdrawal, walletController.createWithdrawal);

/**
 * @route   GET /api/wallet/withdrawals
 * @desc    Get user withdrawal history
 * @access  Private
 */
router.get('/withdrawals', authenticate, validatePagination, walletController.getWithdrawals);

/**
 * @route   POST /api/wallet/bank-details
 * @desc    Add or update bank details
 * @access  Private
 */
router.post('/bank-details', authenticate, validateBankDetails, walletController.saveBankDetails);

/**
 * @route   GET /api/wallet/bank-details
 * @desc    Get bank details
 * @access  Private
 */
router.get('/bank-details', authenticate, walletController.getBankDetails);

module.exports = router;
