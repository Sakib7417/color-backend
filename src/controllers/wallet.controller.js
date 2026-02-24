const walletService = require('../services/wallet.service');
const { success, error, paginated } = require('../utils/response');

/**
 * Wallet Controller - Handles wallet requests
 */
class WalletController {
  /**
   * Get wallet balance
   */
  async getWallet(req, res) {
    try {
      const wallet = await walletService.getWallet(req.user.id);
      return success(res, wallet, 'Wallet retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }

  /**
   * Get transaction history
   */
  async getTransactions(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const type = req.query.type;

      const result = await walletService.getTransactions(req.user.id, page, limit, type);
      return paginated(res, result.transactions, page, limit, result.total, 'Transactions retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Create deposit request
   */
  async createDeposit(req, res) {
    try {
      const { amount, transactionId } = req.body;
      const result = await walletService.createDeposit(req.user.id, amount, transactionId);
      return success(res, result, 'Deposit request submitted successfully. Waiting for admin approval.', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Get deposit history
   */
  async getDeposits(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await walletService.getDeposits(req.user.id, page, limit);
      return paginated(res, result.deposits, page, limit, result.total, 'Deposits retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawal(req, res) {
    try {
      const { amount } = req.body;
      const withdrawal = await walletService.createWithdrawal(req.user.id, amount);
      return success(res, withdrawal, 'Withdrawal request submitted successfully. Waiting for admin approval.', 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawals(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await walletService.getWithdrawals(req.user.id, page, limit);
      return paginated(res, result.withdrawals, page, limit, result.total, 'Withdrawals retrieved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Save bank details
   */
  async saveBankDetails(req, res) {
    try {
      const bankDetails = await walletService.saveBankDetails(req.user.id, req.body);
      return success(res, bankDetails, 'Bank details saved successfully');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  /**
   * Get bank details
   */
  async getBankDetails(req, res) {
    try {
      const bankDetails = await walletService.getBankDetails(req.user.id);
      return success(res, bankDetails, 'Bank details retrieved successfully');
    } catch (err) {
      return error(res, err.message, 404);
    }
  }
}

module.exports = new WalletController();
