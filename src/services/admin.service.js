const prisma = require('../config/database');
const { hashPassword } = require('../utils/auth');
const logger = require('../utils/logger');
const referralService = require('./referral.service');

/**
 * Admin Service - Handles admin operations
 */
class AdminService {
  /**
   * Get dashboard stats
   */
  async getDashboardStats() {
    const [
      totalUsers,
      totalDeposits,
      totalWithdrawals,
      pendingDeposits,
      pendingWithdrawals,
      todayBets,
      totalBalance,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.deposit.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.deposit.count({ where: { status: 'PENDING' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.bet.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
    ]);

    return {
      totalUsers,
      totalDeposits: totalDeposits._sum.amount || 0,
      totalWithdrawals: totalWithdrawals._sum.amount || 0,
      pendingDeposits,
      pendingWithdrawals,
      todayBets,
      totalBalance: totalBalance._sum.balance || 0,
    };
  }

  /**
   * Get all users
   */
  async getUsers(page = 1, limit = 10, search = null) {
    const skip = (page - 1) * limit;

    const where = {};
    if (search) {
      where.OR = [
        { mobileNumber: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { referralCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          mobileNumber: true,
          name: true,
          referralCode: true,
          referredBy: true,
          role: true,
          isActive: true,
          createdAt: true,
          wallet: {
            select: { balance: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  /**
   * Get user details
   */
  async getUserDetails(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        bankDetails: true,
        bets: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            gameRound: {
              select: {
                period: true,
                number: true,
                winningColor: true,
                winningSize: true,
              },
            },
          },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        deposits: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        withdrawals: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user status
   */
  async updateUserStatus(userId, isActive) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        mobileNumber: true,
        name: true,
        isActive: true,
      },
    });

    logger.info(`User ${userId} status updated to ${isActive}`);

    return user;
  }

  /**
   * Get all deposits
   */
  async getDeposits(page = 1, limit = 10, status = null) {
    const skip = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              mobileNumber: true,
              name: true,
            },
          },
        },
      }),
      prisma.deposit.count({ where }),
    ]);

    return { deposits, total, page, limit };
  }

  /**
   * Process deposit (approve/reject)
   */
  async processDeposit(depositId, status, remarks, adminId) {
    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      throw new Error('Deposit not found');
    }

    if (deposit.status !== 'PENDING') {
      throw new Error('This deposit has already been processed');
    }

    const updatedDeposit = await prisma.$transaction(async (tx) => {
      // Update deposit status
      const updated = await tx.deposit.update({
        where: { id: depositId },
        data: {
          status,
          remarks,
          verifiedBy: adminId,
          verifiedAt: new Date(),
        },
      });

      // Update transaction status
      await tx.transaction.updateMany({
        where: {
          referenceId: depositId,
          type: 'DEPOSIT',
        },
        data: {
          status: status === 'APPROVED' ? 'COMPLETED' : 'CANCELLED',
        },
      });

      // If approved, add to wallet
      if (status === 'APPROVED') {
        await tx.wallet.update({
          where: { userId: deposit.userId },
          data: {
            balance: {
              increment: parseFloat(deposit.amount),
            },
          },
        });
      }

      return updated;
    });

    // Process referral bonus if deposit approved
    if (status === 'APPROVED') {
      try {
        await referralService.processReferralBonus(
          depositId,
          deposit.userId,
          deposit.amount
        );
      } catch (bonusErr) {
        logger.error('Error processing referral bonus:', bonusErr);
        // Don't fail the deposit if bonus processing fails
      }
    }

    logger.info(`Deposit ${depositId} ${status.toLowerCase()} by admin: ${adminId}`);

    return updatedDeposit;
  }

  /**
   * Get all withdrawals
   */
  async getWithdrawals(page = 1, limit = 10, status = null) {
    const skip = (page - 1) * limit;

    const where = {};
    if (status) {
      where.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              mobileNumber: true,
              name: true,
            },
          },
        },
      }),
      prisma.withdrawal.count({ where }),
    ]);

    return { withdrawals, total, page, limit };
  }

  /**
   * Process withdrawal (approve/reject)
   */
  async processWithdrawal(withdrawalId, status, remarks, adminId) {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'PENDING') {
      throw new Error('This withdrawal has already been processed');
    }

    const updatedWithdrawal = await prisma.$transaction(async (tx) => {
      // Update withdrawal status
      const updated = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status,
          remarks,
          processedBy: adminId,
          processedAt: new Date(),
        },
      });

      // Update transaction status
      await tx.transaction.updateMany({
        where: {
          referenceId: withdrawalId,
          type: 'WITHDRAWAL',
        },
        data: {
          status: status === 'APPROVED' ? 'COMPLETED' : 'FAILED',
        },
      });

      // If rejected, refund the amount
      if (status === 'REJECTED') {
        await tx.wallet.update({
          where: { userId: withdrawal.userId },
          data: {
            balance: {
              increment: parseFloat(withdrawal.amount),
            },
          },
        });
      }

      return updated;
    });

    logger.info(`Withdrawal ${withdrawalId} ${status.toLowerCase()} by admin: ${adminId}`);

    return updatedWithdrawal;
  }

  /**
   * Get all settings
   */
  async getSettings() {
    const settings = await prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    return settings;
  }

  /**
   * Update setting
   */
  async updateSetting(key, value) {
    const setting = await prisma.setting.update({
      where: { key },
      data: { value },
    });

    return setting;
  }

  /**
   * Update admin UPI ID
   */
  async updateUpiId(adminId, upiId) {
    const admin = await prisma.admin.update({
      where: { id: adminId },
      data: { upiId },
      select: {
        id: true,
        mobileNumber: true,
        upiId: true,
      },
    });

    return admin;
  }

  /**
   * Create new admin (Super Admin only)
   */
  async createAdmin(adminData) {
    const { mobileNumber, password, name, role } = adminData;

    // Validate mobile format
    if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
      throw new Error('Please provide a valid 10-digit mobile number');
    }

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { mobileNumber },
    });

    if (existingAdmin) {
      throw new Error('Mobile number already registered');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    const newAdmin = await prisma.admin.create({
      data: {
        mobileNumber,
        password: hashedPassword,
        name,
        role: role || 'ADMIN',
        isActive: true,
        isVerified: true,
      },
      select: {
        id: true,
        mobileNumber: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    logger.info(`New admin created: ${mobileNumber}`);

    return newAdmin;
  }

  /**
   * Get all admins
   */
  async getAdmins() {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        mobileNumber: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return admins;
  }
}

module.exports = new AdminService();
