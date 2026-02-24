const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create default admin if not exists
  const adminMobile = process.env.ADMIN_DEFAULT_MOBILE || '9876543210';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';

  const existingAdmin = await prisma.admin.findUnique({
    where: { mobileNumber: adminMobile },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    
    await prisma.admin.create({
      data: {
        mobileNumber: adminMobile,
        password: hashedPassword,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        upiId: 'admin@upi',
        isActive: true,
        isVerified: true,
      },
    });
    
    console.log('✅ Default admin created successfully');
    console.log(`   Mobile: ${adminMobile}`);
  } else {
    console.log('ℹ️  Admin already exists, skipping creation');
  }

  // Create default settings
  const defaultSettings = [
    { key: 'GAME_ENABLED', value: 'true', description: 'Enable or disable the game' },
    { key: 'MIN_BET_AMOUNT', value: '10', description: 'Minimum bet amount' },
    { key: 'MAX_BET_AMOUNT', value: '10000', description: 'Maximum bet amount' },
    { key: 'MIN_DEPOSIT_AMOUNT', value: '100', description: 'Minimum deposit amount' },
    { key: 'MIN_WITHDRAWAL_AMOUNT', value: '200', description: 'Minimum withdrawal amount' },
    { key: 'WITHDRAWAL_FEE_PERCENTAGE', value: '0', description: 'Withdrawal fee percentage' },
    { key: 'GREEN_RED_PAYOUT', value: '1.95', description: 'Payout multiplier for Green/Red bets' },
    { key: 'VIOLET_PAYOUT', value: '4.5', description: 'Payout multiplier for Violet bets' },
    { key: 'NUMBER_PAYOUT', value: '8.5', description: 'Payout multiplier for Number bets' },
    { key: 'BIG_SMALL_PAYOUT', value: '1.95', description: 'Payout multiplier for Big/Small bets' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  
  console.log('✅ Default settings created/updated');
  console.log('🌱 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
