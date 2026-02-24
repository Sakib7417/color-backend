const { verifyToken } = require('../utils/auth');
const prisma = require('../config/database');
const { error } = require('../utils/response');

/**
 * Middleware to authenticate JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return error(res, 'Access denied. Invalid token format.', 401);
    }

    const decoded = verifyToken(token);
    
    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, mobileNumber: true, role: true, isActive: true },
    });

    if (!user) {
      return error(res, 'User not found.', 401);
    }

    if (!user.isActive) {
      return error(res, 'Account is deactivated. Please contact support.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired. Please login again.', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return error(res, 'Invalid token.', 401);
    }
    return error(res, 'Authentication failed.', 401);
  }
};

/**
 * Middleware to authenticate Admin JWT token
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return error(res, 'Access denied. Invalid token format.', 401);
    }

    const decoded = verifyToken(token);
    
    // Check if admin exists and is active
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: { id: true, mobileNumber: true, role: true, isActive: true },
    });

    if (!admin) {
      return error(res, 'Admin not found.', 401);
    }

    if (!admin.isActive) {
      return error(res, 'Admin account is deactivated.', 403);
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired. Please login again.', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      return error(res, 'Invalid token.', 401);
    }
    return error(res, 'Authentication failed.', 401);
  }
};

/**
 * Middleware to check if user has admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.admin) {
    return error(res, 'Admin access required.', 403);
  }
  next();
};

/**
 * Middleware to check if user has super admin role
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
    return error(res, 'Super Admin access required.', 403);
  }
  next();
};

module.exports = {
  authenticate,
  authenticateAdmin,
  requireAdmin,
  requireSuperAdmin,
};
