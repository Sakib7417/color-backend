const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * OTP Service - Handles OTP generation and verification
 */
class OtpService {
  /**
   * Generate a 6-digit OTP
   */
  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate referral code (8 characters alphanumeric)
   */
  generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create and send OTP for registration (stores temp data)
   */
  async createRegistrationOtp(mobileNumber, password, invitationCode = null) {
    // Delete any existing OTP for this mobile and purpose
    await prisma.oTP.deleteMany({
      where: {
        mobileNumber,
        purpose: 'REGISTRATION',
      },
    });

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    const otpRecord = await prisma.oTP.create({
      data: {
        mobileNumber,
        otp,
        purpose: 'REGISTRATION',
        expiresAt,
        verified: false,
        tempData: {
          password, // Will be hashed later
          invitationCode,
        },
      },
    });

    // TODO: Integrate with SMS service (Twilio, MSG91, etc.)
    // For now, log the OTP for development
    logger.info(`[REGISTRATION OTP] Mobile: ${mobileNumber}, OTP: ${otp}`);

    return {
      message: 'OTP sent for verification',
      expiresAt,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined, // Only return OTP in dev
    };
  }

  /**
   * Create and send OTP for forgot password
   */
  async createForgotPasswordOtp(mobileNumber) {
    // Delete any existing OTP for this mobile and purpose
    await prisma.oTP.deleteMany({
      where: {
        mobileNumber,
        purpose: 'FORGOT_PASSWORD',
      },
    });

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

    const otpRecord = await prisma.oTP.create({
      data: {
        mobileNumber,
        otp,
        purpose: 'FORGOT_PASSWORD',
        expiresAt,
        verified: false,
      },
    });

    // TODO: Integrate with SMS service
    logger.info(`[FORGOT PASSWORD OTP] Mobile: ${mobileNumber}, OTP: ${otp}`);

    return {
      message: 'OTP sent for verification',
      expiresAt,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    };
  }

  /**
   * Verify OTP for registration and return temp data
   */
  async verifyRegistrationOtp(mobileNumber, otp) {
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        mobileNumber,
        otp,
        purpose: 'REGISTRATION',
        verified: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw new Error('Invalid or expired OTP');
    }

    // Mark OTP as verified
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    return {
      mobileNumber: otpRecord.mobileNumber,
      tempData: otpRecord.tempData,
    };
  }

  /**
   * Verify OTP for forgot password
   */
  async verifyForgotPasswordOtp(mobileNumber, otp) {
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        mobileNumber,
        otp,
        purpose: 'FORGOT_PASSWORD',
        verified: false,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!otpRecord) {
      throw new Error('Invalid or expired OTP');
    }

    // Mark OTP as verified
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    return true;
  }

  /**
   * Delete OTP after use
   */
  async deleteOtp(mobileNumber, purpose) {
    await prisma.oTP.deleteMany({
      where: {
        mobileNumber,
        purpose,
      },
    });
  }

  /**
   * Cleanup expired/used OTPs
   */
  async cleanupOtps() {
    const deleted = await prisma.oTP.deleteMany({
      where: {
        OR: [
          { verified: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    if (deleted.count > 0) {
      logger.info(`Cleaned up ${deleted.count} OTPs`);
    }

    return deleted.count;
  }
}

module.exports = new OtpService();
