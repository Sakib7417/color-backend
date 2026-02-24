const authService = require('../services/auth.service');
const referralService = require('../services/referral.service');
const { success, error } = require('../utils/response');

/**
 * Auth Controller - Handles authentication requests
 */
class AuthController {
  // ==================== USER REGISTRATION (2-STEP) ====================

  /**
   * Step 1: Send OTP for registration
   * POST /api/auth/register
   */
  async register(req, res) {
    try {
      const result = await authService.sendRegistrationOtp(req.body);
      return success(res, result, 'OTP sent for verification');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Step 2: Verify OTP and create user
   * POST /api/auth/verify-otp
   */
  async verifyOtp(req, res) {
    try {
      const { mobileNumber, otp } = req.body;

      if (!mobileNumber || !otp) {
        return error(res, 'Mobile number and OTP are required', 400);
      }

      if (!/^[0-9]{10}$/.test(mobileNumber)) {
        return error(res, 'Please provide a valid 10-digit mobile number', 400);
      }

      const result = await authService.verifyOtpAndCreateUser(mobileNumber, otp);
      return success(res, result, 'User registered successfully', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // ==================== LOGIN ====================

  /**
   * Login user with mobile number
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { mobileNumber, password } = req.body;

      if (!mobileNumber || !password) {
        return error(res, 'Mobile number and password are required', 400);
      }

      const result = await authService.login(mobileNumber, password);
      return success(res, result, 'Login successful');
    } catch (err) {
      return error(res, err.message, 401);
    }
  }

  // ==================== FORGOT PASSWORD (3-STEP) ====================

  /**
   * Step 1: Send OTP for forgot password
   * POST /api/auth/forgot-password/send-otp
   */
  async sendForgotPasswordOtp(req, res) {
    try {
      const { mobileNumber } = req.body;

      if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
        return error(res, 'Please provide a valid 10-digit mobile number', 400);
      }

      const result = await authService.sendForgotPasswordOtp(mobileNumber);
      return success(res, result, 'OTP sent for verification');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Step 2: Verify OTP for forgot password
   * POST /api/auth/forgot-password/verify-otp
   */
  async verifyForgotPasswordOtp(req, res) {
    try {
      const { mobileNumber, otp } = req.body;

      if (!mobileNumber || !otp) {
        return error(res, 'Mobile number and OTP are required', 400);
      }

      await authService.verifyForgotPasswordOtp(mobileNumber, otp);
      return success(res, { verified: true }, 'OTP verified successfully');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Step 3: Reset password after OTP verification
   * POST /api/auth/forgot-password/reset
   */
  async resetPassword(req, res) {
    try {
      const { mobileNumber, newPassword, confirmPassword } = req.body;

      if (!mobileNumber || !newPassword || !confirmPassword) {
        return error(res, 'All fields are required', 400);
      }

      const result = await authService.resetPassword(
        mobileNumber,
        newPassword,
        confirmPassword
      );
      return success(res, result, 'Password reset successful');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  // ==================== PROFILE & TOKEN ====================

  /**
   * Get user profile
   * GET /api/auth/me
   */
  async getProfile(req, res) {
    try {
      const user = await authService.getProfile(req.user.id);
      return success(res, user, 'Profile retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return error(res, 'Refresh token is required', 400);
      }

      const result = await authService.refreshToken(refreshToken);
      return success(res, result, 'Token refreshed successfully');
    } catch (err) {
      return error(res, err.message, 401);
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(req, res) {
    return success(res, null, 'Logout successful');
  }

  // ==================== REFERRAL ====================

  /**
   * Get referral stats
   * GET /api/auth/referral/stats
   */
  async getReferralStats(req, res) {
    try {
      const stats = await referralService.getReferralStats(req.user.id);
      return success(res, stats, 'Referral stats retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get referral history
   * GET /api/auth/referral/history
   */
  async getReferralHistory(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await referralService.getReferralHistory(req.user.id, page, limit);
      return success(res, result, 'Referral history retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  // ==================== ADMIN AUTH ====================

  /**
   * Send OTP for admin registration
   * POST /api/auth/admin/send-otp
   */
  async sendAdminRegistrationOtp(req, res) {
    try {
      const { mobileNumber } = req.body;

      if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
        return error(res, 'Please provide a valid 10-digit mobile number', 400);
      }

      const result = await authService.sendAdminRegistrationOtp(mobileNumber);
      return success(res, result, 'OTP sent for verification');
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Verify OTP and create admin
   * POST /api/auth/admin/verify-otp
   */
  async verifyAdminOtp(req, res) {
    try {
      const { mobileNumber, otp, password, confirmPassword, name } = req.body;

      if (!mobileNumber || !otp || !password || !confirmPassword) {
        return error(res, 'All fields are required', 400);
      }

      const result = await authService.verifyAdminOtpAndCreate(
        mobileNumber,
        otp,
        password,
        confirmPassword,
        name
      );
      return success(res, result, 'Admin registered successfully', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Admin login
   * POST /api/auth/admin/login
   */
  async adminLogin(req, res) {
    try {
      const { mobileNumber, password } = req.body;

      if (!mobileNumber || !password) {
        return error(res, 'Mobile number and password are required', 400);
      }

      const result = await authService.adminLogin(mobileNumber, password);
      return success(res, result, 'Admin login successful');
    } catch (err) {
      return error(res, err.message, 401);
    }
  }
}

module.exports = new AuthController();
