const prisma = require('../config/database');
const { createNewGameRound, PAYOUTS } = require('../routes/game');

// Game configuration
const ROUND_DURATION = parseInt(process.env.GAME_ROUND_DURATION) || 180; // 3 minutes in seconds

// Color mapping for numbers
const NUMBER_COLORS = {
  0: 'VIOLET', // Special case
  1: 'GREEN',
  2: 'RED',
  3: 'GREEN',
  4: 'RED',
  5: 'VIOLET', // Special case
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

/**
 * Game Service - Handles game round lifecycle and result calculation
 */
class GameService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Start the game service
   */
  start() {
    if (this.isRunning) {
      console.log('Game service is already running');
      return;
    }

    console.log('🎮 Starting game service...');
    this.isRunning = true;

    // Check and create initial game round
    this.ensureActiveRound();

    // Start the game loop
    this.intervalId = setInterval(() => {
      this.processGameRounds();
    }, 1000); // Check every second

    console.log(`✅ Game service started. Round duration: ${ROUND_DURATION} seconds`);
  }

  /**
   * Stop the game service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('🛑 Game service stopped');
  }

  /**
   * Ensure there's an active game round
   */
  async ensureActiveRound() {
    try {
      const activeRound = await prisma.gameRound.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (!activeRound) {
        console.log('Creating new game round...');
        await createNewGameRound();
      }
    } catch (err) {
      console.error('Error ensuring active round:', err);
    }
  }

  /**
   * Process game rounds - check for expired rounds and calculate results
   */
  async processGameRounds() {
    try {
      // Find expired active rounds
      const expiredRounds = await prisma.gameRound.findMany({
        where: {
          status: 'ACTIVE',
          startTime: {
            lte: new Date(Date.now() - ROUND_DURATION * 1000),
          },
        },
        include: {
          bets: true,
        },
      });

      for (const round of expiredRounds) {
        await this.completeRound(round);
      }

      // Ensure there's always an active round
      const activeRound = await prisma.gameRound.findFirst({
        where: { status: 'ACTIVE' },
      });

      if (!activeRound) {
        await createNewGameRound();
      }
    } catch (err) {
      console.error('Error processing game rounds:', err);
    }
  }

  /**
   * Complete a game round and calculate results
   */
  async completeRound(round) {
    console.log(`Completing round: ${round.period}`);

    try {
      // Calculate the winning number based on minimum bet strategy
      const winningNumber = await this.calculateWinningNumber(round.id);
      const winningColor = NUMBER_COLORS[winningNumber];
      const winningSize = NUMBER_SIZES[winningNumber];

      // Update round with results
      await prisma.gameRound.update({
        where: { id: round.id },
        data: {
          status: 'COMPLETED',
          number: winningNumber,
          winningColor,
          winningSize,
          endTime: new Date(),
        },
      });

      // Process bets
      await this.processBets(round.id, winningNumber, winningColor, winningSize);

      console.log(`Round ${round.period} completed. Winner: ${winningNumber} (${winningColor}, ${winningSize})`);
    } catch (err) {
      console.error(`Error completing round ${round.period}:`, err);
    }
  }

  /**
   * Calculate winning number based on minimum bet strategy
   * The category with minimum bet amount wins
   */
  async calculateWinningNumber(roundId) {
    try {
      // Get all bets for this round
      const bets = await prisma.bet.findMany({
        where: { gameRoundId: roundId },
      });

      if (bets.length === 0) {
        // No bets, return random number
        return Math.floor(Math.random() * 10);
      }

      // Calculate total bets per number
      const numberBets = {};
      for (let i = 0; i <= 9; i++) {
        numberBets[i] = 0;
      }

      for (const bet of bets) {
        if (bet.betType === 'NUMBER') {
          const num = parseInt(bet.selection);
          numberBets[num] += parseFloat(bet.amount);
        } else if (bet.betType === 'COLOR') {
          // Add to all numbers with this color
          for (let i = 0; i <= 9; i++) {
            if (NUMBER_COLORS[i] === bet.selection || 
                (bet.selection === 'VIOLET' && (i === 0 || i === 5))) {
              numberBets[i] += parseFloat(bet.amount);
            }
          }
        } else if (bet.betType === 'SIZE') {
          // Add to all numbers with this size
          for (let i = 0; i <= 9; i++) {
            if (NUMBER_SIZES[i] === bet.selection) {
              numberBets[i] += parseFloat(bet.amount);
            }
          }
        }
      }

      // Find number(s) with minimum bet
      let minBet = Infinity;
      let winningNumbers = [];

      for (let i = 0; i <= 9; i++) {
        if (numberBets[i] < minBet) {
          minBet = numberBets[i];
          winningNumbers = [i];
        } else if (numberBets[i] === minBet) {
          winningNumbers.push(i);
        }
      }

      // If multiple numbers have same minimum bet, pick randomly
      const winningNumber = winningNumbers[Math.floor(Math.random() * winningNumbers.length)];
      
      return winningNumber;
    } catch (err) {
      console.error('Error calculating winning number:', err);
      // Return random number on error
      return Math.floor(Math.random() * 10);
    }
  }

  /**
   * Process all bets for a completed round
   */
  async processBets(roundId, winningNumber, winningColor, winningSize) {
    try {
      const bets = await prisma.bet.findMany({
        where: { gameRoundId: roundId },
      });

      for (const bet of bets) {
        let isWin = false;
        let winAmount = 0;

        if (bet.betType === 'NUMBER') {
          const betNumber = parseInt(bet.selection);
          if (betNumber === winningNumber) {
            isWin = true;
            winAmount = parseFloat(bet.amount) * PAYOUTS.NUMBER;
          }
        } else if (bet.betType === 'COLOR') {
          const betColor = bet.selection;
          // Check for violet (0 and 5 are violet)
          if (betColor === 'VIOLET' && (winningNumber === 0 || winningNumber === 5)) {
            isWin = true;
            winAmount = parseFloat(bet.amount) * PAYOUTS.COLOR.VIOLET;
          } else if (betColor === winningColor) {
            isWin = true;
            winAmount = parseFloat(bet.amount) * PAYOUTS.COLOR[winningColor];
          }
        } else if (bet.betType === 'SIZE') {
          const betSize = bet.selection;
          if (betSize === winningSize) {
            isWin = true;
            winAmount = parseFloat(bet.amount) * PAYOUTS.SIZE[winningSize];
          }
        }

        // Update bet result
        await prisma.$transaction(async (tx) => {
          await tx.bet.update({
            where: { id: bet.id },
            data: {
              result: isWin ? 'WON' : 'LOST',
              winAmount: isWin ? winAmount : 0,
            },
          });

          if (isWin) {
            // Add winnings to user wallet
            await tx.wallet.update({
              where: { userId: bet.userId },
              data: {
                balance: {
                  increment: winAmount,
                },
              },
            });

            // Create transaction record
            await tx.transaction.create({
              data: {
                userId: bet.userId,
                type: 'BET_WON',
                amount: winAmount,
                status: 'COMPLETED',
                referenceId: bet.id,
                description: `Won bet on ${bet.betType}: ${bet.selection}`,
              },
            });
          }
        });
      }
    } catch (err) {
      console.error('Error processing bets:', err);
    }
  }

  /**
   * Get current game status
   */
  async getGameStatus() {
    try {
      const activeRound = await prisma.gameRound.findFirst({
        where: { status: 'ACTIVE' },
        include: {
          _count: {
            select: { bets: true },
          },
        },
      });

      if (!activeRound) {
        return null;
      }

      const now = new Date();
      const endTime = new Date(activeRound.startTime);
      endTime.setSeconds(endTime.getSeconds() + ROUND_DURATION);
      
      const remainingTime = Math.max(0, Math.floor((endTime - now) / 1000));

      return {
        round: activeRound,
        remainingTime,
        roundDuration: ROUND_DURATION,
      };
    } catch (err) {
      console.error('Error getting game status:', err);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new GameService();
