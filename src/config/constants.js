/**
 * Application Constants
 * Centralized constants for the application
 */

// Payout multipliers
const PAYOUTS = {
  COLOR: {
    GREEN: 1.95,  // 95% profit
    RED: 1.95,    // 95% profit
    VIOLET: 4.5,  // 45% profit (higher risk)
  },
  NUMBER: 8.5,    // 850% profit (highest risk)
  SIZE: {
    BIG: 1.95,    // 95% profit
    SMALL: 1.95,  // 95% profit
  },
};

// Color mapping for numbers
const NUMBER_COLORS = {
  0: 'VIOLET',
  1: 'GREEN',
  2: 'RED',
  3: 'GREEN',
  4: 'RED',
  5: 'VIOLET',
  6: 'RED',
  7: 'GREEN',
  8: 'RED',
  9: 'GREEN',
};

// Size mapping for numbers
const NUMBER_SIZES = {
  0: 'SMALL',
  1: 'SMALL',
  2: 'SMALL',
  3: 'SMALL',
  4: 'SMALL',
  5: 'BIG',
  6: 'BIG',
  7: 'BIG',
  8: 'BIG',
  9: 'BIG',
};

// Bet categories
const BET_CATEGORIES = {
  COLOR: ['GREEN', 'RED', 'VIOLET'],
  SIZE: ['BIG', 'SMALL'],
  NUMBER: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
};

// Transaction types
const TRANSACTION_TYPES = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
  BET_PLACED: 'BET_PLACED',
  BET_WON: 'BET_WON',
  REFUND: 'REFUND',
};

// Transaction statuses
const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

// Bet results
const BET_RESULT = {
  PENDING: 'PENDING',
  WON: 'WON',
  LOST: 'LOST',
  CANCELLED: 'CANCELLED',
};

// Game statuses
const GAME_STATUS = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

// User roles
const USER_ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
};

// Admin roles
const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MODERATOR: 'MODERATOR',
};

// Deposit statuses
const DEPOSIT_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// Withdrawal statuses
const WITHDRAWAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
};

// Minimum amounts
const MIN_AMOUNTS = {
  BET: 10,
  DEPOSIT: 100,
  WITHDRAWAL: 200,
};

// Maximum amounts
const MAX_AMOUNTS = {
  BET: 10000,
};

module.exports = {
  PAYOUTS,
  NUMBER_COLORS,
  NUMBER_SIZES,
  BET_CATEGORIES,
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  BET_RESULT,
  GAME_STATUS,
  USER_ROLES,
  ADMIN_ROLES,
  DEPOSIT_STATUS,
  WITHDRAWAL_STATUS,
  MIN_AMOUNTS,
  MAX_AMOUNTS,
};
