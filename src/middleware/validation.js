const { body, param, query, validationResult } = require('express-validator');
const { error } = require('../utils/response');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, 'Validation failed', 400, errors.array());
  }
  next();
};

// User Registration Validation
const validateUserRegistration = [
  body('mobileNumber')
    .notEmpty()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Confirm password is required'),
  body('invitationCode')
    .optional()
    .trim()
    .isLength({ min: 8, max: 8 })
    .withMessage('Invalid referral code'),
  handleValidationErrors,
];

// User OTP Verification Validation
const validateVerifyOtp = [
  body('mobileNumber')
    .notEmpty()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
  body('otp')
    .notEmpty()
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits'),
  handleValidationErrors,
];

// User Login Validation
const validateUserLogin = [
  body('mobileNumber')
    .notEmpty()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

// Admin Login Validation
const validateAdminLogin = [
  body('mobileNumber')
    .notEmpty()
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

// Deposit Validation
const validateDeposit = [
  body('amount')
    .isFloat({ min: 100 })
    .withMessage('Minimum deposit amount is 100'),
  body('transactionId')
    .notEmpty()
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Transaction ID must be between 5 and 100 characters'),
  handleValidationErrors,
];

// Withdrawal Validation
const validateWithdrawal = [
  body('amount')
    .isFloat({ min: 200 })
    .withMessage('Minimum withdrawal amount is 200'),
  handleValidationErrors,
];

// Bank Details Validation
const validateBankDetails = [
  body('accountHolder')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Account holder name is required'),
  body('accountNumber')
    .notEmpty()
    .trim()
    .isLength({ min: 9, max: 20 })
    .withMessage('Please provide a valid account number'),
  body('ifscCode')
    .notEmpty()
    .trim()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Please provide a valid IFSC code'),
  body('bankName')
    .notEmpty()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Bank name is required'),
  body('branchName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Branch name must be less than 100 characters'),
  handleValidationErrors,
];

// Bet Placement Validation
const validateBet = [
  body('gameRoundId')
    .notEmpty()
    .isUUID()
    .withMessage('Valid game round ID is required'),
  body('betType')
    .notEmpty()
    .isIn(['COLOR', 'NUMBER', 'SIZE'])
    .withMessage('Bet type must be COLOR, NUMBER, or SIZE'),
  body('selection')
    .notEmpty()
    .trim()
    .custom((value, { req }) => {
      const betType = req.body.betType;
      if (betType === 'COLOR') {
        if (!['GREEN', 'RED', 'VIOLET'].includes(value.toUpperCase())) {
          throw new Error('Color selection must be GREEN, RED, or VIOLET');
        }
      } else if (betType === 'NUMBER') {
        const num = parseInt(value);
        if (isNaN(num) || num < 0 || num > 9) {
          throw new Error('Number selection must be between 0 and 9');
        }
      } else if (betType === 'SIZE') {
        if (!['BIG', 'SMALL'].includes(value.toUpperCase())) {
          throw new Error('Size selection must be BIG or SMALL');
        }
      }
      return true;
    }),
  body('amount')
    .isFloat({ min: 10 })
    .withMessage('Minimum bet amount is 10'),
  handleValidationErrors,
];

// Approve/Reject Deposit Validation
const validateDepositAction = [
  param('id')
    .isUUID()
    .withMessage('Valid deposit ID is required'),
  body('status')
    .notEmpty()
    .isIn(['APPROVED', 'REJECTED'])
    .withMessage('Status must be APPROVED or REJECTED'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks must be less than 500 characters'),
  handleValidationErrors,
];

// Approve/Reject Withdrawal Validation
const validateWithdrawalAction = [
  param('id')
    .isUUID()
    .withMessage('Valid withdrawal ID is required'),
  body('status')
    .notEmpty()
    .isIn(['APPROVED', 'REJECTED'])
    .withMessage('Status must be APPROVED or REJECTED'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks must be less than 500 characters'),
  handleValidationErrors,
];

// Pagination Validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
];

module.exports = {
  validateUserRegistration,
  validateVerifyOtp,
  validateUserLogin,
  validateAdminLogin,
  validateDeposit,
  validateWithdrawal,
  validateBankDetails,
  validateBet,
  validateDepositAction,
  validateWithdrawalAction,
  validatePagination,
  handleValidationErrors,
};
