const { error } = require('../utils/response');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Prisma errors
  if (err.code) {
    switch (err.code) {
      case 'P2002':
        const field = err.meta?.target?.[0] || 'field';
        return error(res, `${field} already exists. Please use a different value.`, 409);
      
      case 'P2003':
        return error(res, 'Related record not found.', 400);
      
      case 'P2025':
        return error(res, 'Record not found.', 404);
      
      case 'P2014':
        return error(res, 'Invalid ID provided.', 400);
      
      default:
        console.error('Prisma Error:', err);
        return error(res, 'Database error occurred.', 500);
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Invalid token.', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expired.', 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return error(res, err.message, 400);
  }

  // Syntax errors (JSON parsing)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return error(res, 'Invalid JSON format.', 400);
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    return error(res, 'Something went wrong. Please try again later.', 500);
  }

  return error(res, message, statusCode);
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res) => {
  return error(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = {
  errorHandler,
  notFound,
};
