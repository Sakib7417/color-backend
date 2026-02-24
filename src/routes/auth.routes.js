const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// ==================== USER REGISTRATION (2-STEP) ====================

/**
 * @route   POST /api/auth/register
 * @desc    Step 1: Send OTP for registration (user not created yet)
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Step 2: Verify OTP and create user
 * @access  Public
 */
router.post('/verify-otp', authController.verifyOtp);

// ==================== LOGIN ====================

/**
 * @route   POST /api/auth/login
 * @desc    Login user with mobile number
 * @access  Public
 */
router.post('/login', authController.login);

// ==================== FORGOT PASSWORD (3-STEP) ====================

/**
 * @route   POST /api/auth/forgot-password/send-otp
 * @desc    Step 1: Send OTP for forgot password
 * @access  Public
 */
router.post('/forgot-password/send-otp', authController.sendForgotPasswordOtp);

/**
 * @route   POST /api/auth/forgot-password/verify-otp
 * @desc    Step 2: Verify OTP for forgot password
 * @access  Public
 */
router.post('/forgot-password/verify-otp', authController.verifyForgotPasswordOtp);

/**
 * @route   POST /api/auth/forgot-password/reset
 * @desc    Step 3: Reset password after OTP verification
 * @access  Public
 */
router.post('/forgot-password/reset', authController.resetPassword);

// ==================== PROFILE & TOKEN ====================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', authController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

// ==================== REFERRAL ====================

/**
 * @route   GET /api/auth/referral/stats
 * @desc    Get referral statistics
 * @access  Private
 */
router.get('/referral/stats', authenticate, authController.getReferralStats);

/**
 * @route   GET /api/auth/referral/history
 * @desc    Get referral bonus history
 * @access  Private
 */
router.get('/referral/history', authenticate, authController.getReferralHistory);

// ==================== ADMIN AUTH ====================

/**
 * @route   POST /api/auth/admin/send-otp
 * @desc    Send OTP for admin registration
 * @access  Public
 */
router.post('/admin/send-otp', authController.sendAdminRegistrationOtp);

/**
 * @route   POST /api/auth/admin/verify-otp
 * @desc    Verify OTP and create admin
 * @access  Public
 */
router.post('/admin/verify-otp', authController.verifyAdminOtp);

/**
 * @route   POST /api/auth/admin/login
 * @desc    Admin login with mobile number
 * @access  Public
 */
router.post('/admin/login', authController.adminLogin);

module.exports = router;
