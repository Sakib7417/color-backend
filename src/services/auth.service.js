const prisma = require('../config/database');
const { hashPassword, comparePassword, generateToken, generateRefreshToken } = require('../utils/auth');
const otpService = require('./otp.service');
const logger = require('../utils/logger');

/**
 * Auth Service - Handles authentication logic
 */
class AuthService {
  // ==================== STEP 1: SEND OTP ====================

  /**
   * Step 1: Send OTP for registration (user not created yet)
   */
  async sendRegistrationOtp(registrationData) {
    const { mobileNumber, password, confirmPassword, invitationCode } = registrationData;

    // Validate mobile format
    if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
      throw new Error('Please provide a valid 10-digit mobile number');
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      throw new Error('Password and confirm password do not match');
    }

    // Validate password strength
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Check if mobile already registered
    const existingUser = await prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (existingUser) {
      throw new Error('Mobile number already registered');
    }

    // Validate invitation code if provided
    if (invitationCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: invitationCode },
      });

      if (!referrer) {
        throw new Error('Invalid referral code');
      }
    }

    // Create OTP with temp data (password stored temporarily, will hash after verification)
    return await otpService.createRegistrationOtp(mobileNumber, password, invitationCode);
  }

  // ==================== STEP 2: VERIFY OTP & CREATE USER ====================

  /**
   * Step 2: Verify OTP and create user
   */
  async verifyOtpAndCreateUser(mobileNumber, otp) {
    // Verify OTP and get temp data
    const { tempData } = await otpService.verifyRegistrationOtp(mobileNumber, otp);

    if (!tempData || !tempData.password) {
      throw new Error('Invalid registration data');
    }

    // Double-check mobile not already registered (prevent race condition)
    const existingUser = await prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (existingUser) {
      // Clean up OTP
      await otpService.deleteOtp(mobileNumber, 'REGISTRATION');
      throw new Error('Mobile number already registered');
    }

    // Hash password
    const hashedPassword = await hashPassword(tempData.password);

    // Generate unique referral code
    let referralCode;
    let isUnique = false;
    while (!isUnique) {
      referralCode = otpService.generateReferralCode();
      const existing = await prisma.user.findUnique({
        where: { referralCode },
      });
      if (!existing) {
        isUnique = true;
      }
    }

    // Find referrer if invitation code provided
    let referrerId = null;
    if (tempData.invitationCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: tempData.invitationCode },
      });

      if (referrer) {
        // Prevent self-referral
        if (referrer.mobileNumber === mobileNumber) {
          throw new Error('Cannot use your own referral code');
        }
        referrerId = referrer.id;
      }
    }

    // Create user with wallet in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          mobileNumber,
          password: hashedPassword,
          role: 'USER',
          isVerified: true,
          isActive: true,
          referralCode,
          referredBy: referrerId,
        },
        select: {
          id: true,
          mobileNumber: true,
          role: true,
          referralCode: true,
          referredBy: true,
          createdAt: true,
        },
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
          balance: 0,
        },
      });

      return newUser;
    });

    // Delete OTP after successful registration
    await otpService.deleteOtp(mobileNumber, 'REGISTRATION');

    // Generate tokens
    const token = generateToken({ userId: user.id, mobileNumber: user.mobileNumber, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    logger.info(`User registered successfully: ${mobileNumber}`);

    return {
      message: 'User registered successfully',
      user,
      tokens: {
        accessToken: token,
        refreshToken,
      },
    };
  }

  // ==================== LOGIN ====================

  /**
   * Login user with mobile number
   */
  async login(mobileNumber, password) {
    const user = await prisma.user.findUnique({
      where: { mobileNumber },
      include: {
        wallet: {
          select: { balance: true },
        },
      },
    });

    if (!user) {
      throw new Error('Invalid mobile number or password');
    }

    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    if (!user.isVerified) {
      throw new Error('Account not verified');
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid mobile number or password');
    }

    const token = generateToken({ userId: user.id, mobileNumber: user.mobileNumber, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id });

    const { password: _, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${mobileNumber}`);

    return {
      user: userWithoutPassword,
      tokens: {
        accessToken: token,
        refreshToken,
      },
    };
  }

  // ==================== FORGOT PASSWORD ====================

  /**
   * Step 1: Send OTP for forgot password
   */
  async sendForgotPasswordOtp(mobileNumber) {
    // Validate mobile format
    if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
      throw new Error('Please provide a valid 10-digit mobile number');
    }

    const user = await prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new Error('Mobile number not found');
    }

    return await otpService.createForgotPasswordOtp(mobileNumber);
  }

  /**
   * Step 2: Verify OTP for forgot password
   */
  async verifyForgotPasswordOtp(mobileNumber, otp) {
    return await otpService.verifyForgotPasswordOtp(mobileNumber, otp);
  }

  /**
   * Step 3: Reset password after OTP verification
   */
  async resetPassword(mobileNumber, newPassword, confirmPassword) {
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      throw new Error('Password and confirm password do not match');
    }

    // Validate password strength
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    const user = await prisma.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Clean up any forgot password OTPs
    await otpService.deleteOtp(mobileNumber, 'FORGOT_PASSWORD');

    logger.info(`Password reset for: ${mobileNumber}`);

    return { message: 'Password reset successful' };
  }

  // ==================== PROFILE & TOKEN ====================

  /**
   * Get user profile
   */
  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mobileNumber: true,
        name: true,
        role: true,
        isActive: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
        wallet: {
          select: { balance: true },
        },
        bankDetails: {
          select: {
            accountHolder: true,
            accountNumber: true,
            ifscCode: true,
            bankName: true,
            branchName: true,
          },
        },
        _count: {
          select: { referrals: true },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    const { verifyRefreshToken } = require('../utils/auth');
    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, mobileNumber: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid refresh token');
    }

    const newToken = generateToken({ userId: user.id, mobileNumber: user.mobileNumber, role: user.role });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    return {
      tokens: {
        accessToken: newToken,
        refreshToken: newRefreshToken,
      },
    };
  }

  // ==================== ADMIN AUTH ====================

  /**
   * Send OTP for admin registration
   */
  async sendAdminRegistrationOtp(mobileNumber) {
    // Validate mobile format
    if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
      throw new Error('Please provide a valid 10-digit mobile number');
    }

    const existingAdmin = await prisma.admin.findUnique({
      where: { mobileNumber },
    });

    if (existingAdmin) {
      throw new Error('Mobile number already registered');
    }

    return await otpService.createRegistrationOtp(mobileNumber, null, null);
  }

  /**
   * Verify OTP and create admin
   */
  async verifyAdminOtpAndCreate(mobileNumber, otp, password, confirmPassword, name) {
    // Validate passwords match
    if (password !== confirmPassword) {
      throw new Error('Password and confirm password do not match');
    }

    // Verify OTP
    const { tempData } = await otpService.verifyRegistrationOtp(mobileNumber, otp);

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { mobileNumber },
    });

    if (existingAdmin) {
      await otpService.deleteOtp(mobileNumber, 'REGISTRATION');
      throw new Error('Mobile number already registered');
    }

    const hashedPassword = await hashPassword(password);

    const admin = await prisma.admin.create({
      data: {
        mobileNumber,
        password: hashedPassword,
        name,
        role: 'ADMIN',
        isVerified: true,
        isActive: true,
      },
      select: {
        id: true,
        mobileNumber: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Delete OTP
    await otpService.deleteOtp(mobileNumber, 'REGISTRATION');

    const token = generateToken({
      adminId: admin.id,
      mobileNumber: admin.mobileNumber,
      role: admin.role,
    });

    logger.info(`Admin registered: ${mobileNumber}`);

    return {
      message: 'Admin registered successfully',
      admin,
      token,
    };
  }

  /**
   * Admin login
   */
  async adminLogin(mobileNumber, password) {
    const admin = await prisma.admin.findUnique({
      where: { mobileNumber },
    });

    if (!admin) {
      throw new Error('Invalid mobile number or password');
    }

    if (!admin.isActive) {
      throw new Error('Admin account is deactivated');
    }

    if (!admin.isVerified) {
      throw new Error('Admin account not verified');
    }

    const isPasswordValid = await comparePassword(password, admin.password);

    if (!isPasswordValid) {
      throw new Error('Invalid mobile number or password');
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken({
      adminId: admin.id,
      mobileNumber: admin.mobileNumber,
      role: admin.role,
    });

    const { password: _, ...adminWithoutPassword } = admin;

    logger.info(`Admin logged in: ${mobileNumber}`);

    return {
      admin: adminWithoutPassword,
      token,
    };
  }
}

module.exports = new AuthService();
