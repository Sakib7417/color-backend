const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Wallet Service - Handles wallet, deposit, and withdrawal logic
 */
class WalletService {
  /**
   * Get wallet by user ID
   */
  async getWallet(userId) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      select: {
        id: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return wallet;
  }

  /**
   * Get transaction history
   */
  async getTransactions(userId, page = 1, limit = 10, type = null) {
    const skip = (page - 1) * limit;

    const where = { userId };
    if (type) {
      where.type = type;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total, page, limit };
  }

  /**
   * Create deposit request
   */
  async createDeposit(userId, amount, transactionId) {
    const depositAmount = parseFloat(amount);

    // Get admin's UPI ID (first active admin with UPI ID set)
    const admin = await prisma.admin.findFirst({
      where: { 
        isActive: true,
        upiId: { not: null }
      },
      select: { upiId: true },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin || !admin.upiId) {
      throw new Error('Deposit service temporarily unavailable');
    }

    // Check for duplicate transaction ID
    const existingDeposit = await prisma.deposit.findFirst({
      where: { transactionId },
    });

    if (existingDeposit) {
      throw new Error('Transaction ID already used');
    }

    // Create deposit request
    const deposit = await prisma.deposit.create({
      data: {
        userId,
        amount: depositAmount,
        upiId: admin.upiId,
        transactionId,
        status: 'PENDING',
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        amount: depositAmount,
        status: 'PENDING',
        referenceId: deposit.id,
        description: `Deposit request via UPI: ${admin.upiId}`,
      },
    });

    logger.info(`Deposit request created: ${deposit.id} for user: ${userId}`);

    return { deposit, adminUpiId: admin.upiId };
  }

  /**
   * Get deposit history
   */
  async getDeposits(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deposit.count({ where: { userId } }),
    ]);

    return { deposits, total, page, limit };
  }

  /**
   * Create withdrawal request
   */
  async createWithdrawal(userId, amount) {
    const withdrawalAmount = parseFloat(amount);

    // Check if user has bank details
    const bankDetails = await prisma.bankDetails.findUnique({
      where: { userId },
    });

    if (!bankDetails) {
      throw new Error('Please add your bank details before requesting a withdrawal');
    }

    // Check wallet balance
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet || parseFloat(wallet.balance) < withdrawalAmount) {
      throw new Error('Insufficient balance');
    }

    // Check for pending withdrawals
    const pendingWithdrawal = await prisma.withdrawal.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });

    if (pendingWithdrawal) {
      throw new Error('You already have a pending withdrawal request');
    }

    // Create withdrawal request
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId,
        amount: withdrawalAmount,
        status: 'PENDING',
        bankDetails: {
          accountHolder: bankDetails.accountHolder,
          accountNumber: bankDetails.accountNumber,
          ifscCode: bankDetails.ifscCode,
          bankName: bankDetails.bankName,
          branchName: bankDetails.branchName,
        },
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        amount: withdrawalAmount,
        status: 'PENDING',
        referenceId: withdrawal.id,
        description: `Withdrawal request to bank account: ${bankDetails.bankName}`,
      },
    });

    // Deduct amount from wallet
    await prisma.wallet.update({
      where: { userId },
      data: {
        balance: {
          decrement: withdrawalAmount,
        },
      },
    });

    logger.info(`Withdrawal request created: ${withdrawal.id} for user: ${userId}`);

    return withdrawal;
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawals(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.withdrawal.count({ where: { userId } }),
    ]);

    return { withdrawals, total, page, limit };
  }

  /**
   * Save or update bank details
   */
  async saveBankDetails(userId, bankData) {
    const { accountHolder, accountNumber, ifscCode, bankName, branchName } = bankData;

    const bankDetails = await prisma.bankDetails.upsert({
      where: { userId },
      update: {
        accountHolder,
        accountNumber,
        ifscCode,
        bankName,
        branchName,
      },
      create: {
        userId,
        accountHolder,
        accountNumber,
        ifscCode,
        bankName,
        branchName,
      },
    });

    return bankDetails;
  }

  /**
   * Get bank details
   */
  async getBankDetails(userId) {
    const bankDetails = await prisma.bankDetails.findUnique({
      where: { userId },
    });

    if (!bankDetails) {
      throw new Error('Bank details not found');
    }

    return bankDetails;
  }

  /**
   * Get admin UPI ID for deposit
   */
  async getAdminUpiId() {
    // Get admin's UPI ID (first active admin with UPI ID set)
    const admin = await prisma.admin.findFirst({
      where: { 
        isActive: true,
        upiId: { not: null }
      },
      select: { 
        upiId: true,
        name: true
      },
      orderBy: { createdAt: 'asc' }
    });

    if (!admin || !admin.upiId) {
      throw new Error('Deposit service temporarily unavailable. Please contact support.');
    }

    return {
      upiId: admin.upiId,
      adminName: admin.name || 'Admin'
    };
  }
}

module.exports = new WalletService();
