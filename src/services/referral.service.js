const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Referral Service - Handles referral bonus logic
 */
class ReferralService {
  /**
   * Process referral bonus when a deposit is approved
   */
  async processReferralBonus(depositId, userId, depositAmount) {
    try {
      // Check if bonus already processed
      const deposit = await prisma.deposit.findUnique({
        where: { id: depositId },
      });

      if (deposit.referralBonusProcessed) {
        logger.info(`Referral bonus already processed for deposit: ${depositId}`);
        return null;
      }

      // Get user with referrer info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          mobileNumber: true,
          referredBy: true,
        },
      });

      if (!user || !user.referredBy) {
        logger.info(`No referrer found for user: ${userId}`);
        // Mark as processed even if no referrer
        await prisma.deposit.update({
          where: { id: depositId },
          data: { referralBonusProcessed: true },
        });
        return null;
      }

      // Calculate 10% bonus
      const bonusAmount = parseFloat(depositAmount) * 0.10;

      // Get referrer
      const referrer = await prisma.user.findUnique({
        where: { id: user.referredBy },
        include: { wallet: true },
      });

      if (!referrer || !referrer.isActive) {
        logger.info(`Referrer not found or inactive: ${user.referredBy}`);
        await prisma.deposit.update({
          where: { id: depositId },
          data: { referralBonusProcessed: true },
        });
        return null;
      }

      // Process bonus in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Add bonus to referrer wallet
        await tx.wallet.update({
          where: { userId: referrer.id },
          data: {
            balance: {
              increment: bonusAmount,
            },
          },
        });

        // Create bonus transaction record
        const transaction = await tx.transaction.create({
          data: {
            userId: referrer.id,
            type: 'REFERRAL_BONUS',
            amount: bonusAmount,
            status: 'COMPLETED',
            referenceId: depositId,
            description: `Referral bonus from ${user.mobileNumber}'s deposit of ₹${depositAmount}`,
            metadata: {
              referredUserId: user.id,
              referredUserMobile: user.mobileNumber,
              depositAmount: depositAmount,
              bonusPercentage: 10,
            },
          },
        });

        // Mark deposit as bonus processed
        await tx.deposit.update({
          where: { id: depositId },
          data: { referralBonusProcessed: true },
        });

        return transaction;
      });

      logger.info(`Referral bonus of ₹${bonusAmount} given to ${referrer.mobileNumber} for ${user.mobileNumber}'s deposit`);

      return {
        bonusAmount,
        referrerId: referrer.id,
        referrerMobile: referrer.mobileNumber,
        transaction: result,
      };
    } catch (err) {
      logger.error('Error processing referral bonus:', err);
      throw err;
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        referredBy: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get total referrals
    const totalReferrals = await prisma.user.count({
      where: { referredBy: userId },
    });

    // Get total bonus earned
    const bonusStats = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'REFERRAL_BONUS',
        status: 'COMPLETED',
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    // Get referred users list
    const referredUsers = await prisma.user.findMany({
      where: { referredBy: userId },
      select: {
        id: true,
        mobileNumber: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      referralCode: user.referralCode,
      totalReferrals,
      totalBonusEarned: bonusStats._sum.amount || 0,
      totalBonusTransactions: bonusStats._count.id || 0,
      referredUsers,
    };
  }

  /**
   * Get referral history (bonus transactions)
   */
  async getReferralHistory(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId,
          type: 'REFERRAL_BONUS',
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({
        where: {
          userId,
          type: 'REFERRAL_BONUS',
        },
      }),
    ]);

    return { transactions, total, page, limit };
  }
}

module.exports = new ReferralService();
