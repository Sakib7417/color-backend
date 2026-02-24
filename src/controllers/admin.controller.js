const adminService = require('../services/admin.service');
const { success, error, paginated } = require('../utils/response');

/**
 * Admin Controller - Handles admin requests
 */
class AdminController {
  /**
   * Get admin profile
   */
  async getProfile(req, res) {
    try {
      const admin = await adminService.getAdminProfile(req.admin.id);
      return success(res, admin, 'Profile retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(req, res) {
    try {
      const stats = await adminService.getDashboardStats();
      return success(res, { stats }, 'Dashboard stats retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get all users
   */
  async getUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search;

      const result = await adminService.getUsers(page, limit, search);
      return paginated(res, result.users, page, limit, result.total, 'Users retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get user details
   */
  async getUserDetails(req, res) {
    try {
      const { id } = req.params;
      const user = await adminService.getUserDetails(id);
      return success(res, user, 'User details retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(req, res) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return error(res, 'isActive must be a boolean value', 400);
      }

      const user = await adminService.updateUserStatus(id, isActive);
      return success(res, user, `User ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get all deposits
   */
  async getDeposits(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;

      const result = await adminService.getDeposits(page, limit, status);
      return paginated(res, result.deposits, page, limit, result.total, 'Deposits retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Process deposit
   */
  async processDeposit(req, res) {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;

      const deposit = await adminService.processDeposit(id, status, remarks, req.admin.id);
      return success(res, deposit, `Deposit ${status.toLowerCase()} successfully`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Get all withdrawals
   */
  async getWithdrawals(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;

      const result = await adminService.getWithdrawals(page, limit, status);
      return paginated(res, result.withdrawals, page, limit, result.total, 'Withdrawals retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Process withdrawal
   */
  async processWithdrawal(req, res) {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;

      const withdrawal = await adminService.processWithdrawal(id, status, remarks, req.admin.id);
      return success(res, withdrawal, `Withdrawal ${status.toLowerCase()} successfully`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Get all settings
   */
  async getSettings(req, res) {
    try {
      const settings = await adminService.getSettings();
      return success(res, settings, 'Settings retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Update setting
   */
  async updateSetting(req, res) {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (!value) {
        return error(res, 'Value is required', 400);
      }

      const setting = await adminService.updateSetting(key, value);
      return success(res, setting, 'Setting updated successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Update UPI ID
   */
  async updateUpiId(req, res) {
    try {
      const { upiId } = req.body;

      if (!upiId) {
        return error(res, 'UPI ID is required', 400);
      }

      const admin = await adminService.updateUpiId(req.admin.id, upiId);
      return success(res, admin, 'UPI ID updated successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Create new admin
   */
  async createAdmin(req, res) {
    try {
      const newAdmin = await adminService.createAdmin(req.body);
      return success(res, newAdmin, 'Admin created successfully', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Get all admins
   */
  async getAdmins(req, res) {
    try {
      const admins = await adminService.getAdmins();
      return success(res, admins, 'Admins retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new AdminController();
