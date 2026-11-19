require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const { connectDB, closeDB } = require('../config/db');
const User = require('../models/User');

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
};

const runReset = async () => {
  try {
    await connectDB();

    const targetEmail = (process.env.FIRST_SUPERUSER_EMAIL || 'admin@labelguard.ai').toLowerCase();
    let admin = await User.findOne({ email: targetEmail });

    if (!admin) {
      console.log(`[AdminReset] No user found with email: ${targetEmail}`);
      const createNew = await askQuestion(`Would you like to create superadmin ${targetEmail}? (y/N): `);
      if (createNew.trim().toLowerCase() !== 'y') {
        console.log('[AdminReset] Operation cancelled.');
        await closeDB();
        process.exit(0);
      }
      admin = new User({
        email: targetEmail,
        fullName: process.env.FIRST_SUPERUSER_FULLNAME || 'LabelGuard Chief Inspector',
        role: 'ADMIN',
        isActive: true,
      });
    }

    // Determine new password
    let newPassword = process.argv[2];
    if (!newPassword) {
      const fromEnv = process.env.FIRST_SUPERUSER_PASSWORD;
      if (fromEnv) {
        console.log('[AdminReset] No password provided on CLI. Found FIRST_SUPERUSER_PASSWORD in environment.');
        const useEnv = await askQuestion('Use FIRST_SUPERUSER_PASSWORD from .env? (Y/n): ');
        if (useEnv.trim().toLowerCase() !== 'n') {
          newPassword = fromEnv;
        }
      }
    }

    if (!newPassword) {
      newPassword = await askQuestion('Enter new password for superadmin (min 8 chars): ');
    }

    if (!newPassword || newPassword.length < 8) {
      console.error('[AdminReset] Error: Password must be at least 8 characters long.');
      await closeDB();
      process.exit(1);
    }

    admin.password = newPassword;
    await admin.save();

    console.log(`[AdminReset] Password successfully updated for ${targetEmail}.`);
    console.log('[AdminReset] You can now log in via the web interface.');
  } catch (err) {
    console.error('[AdminReset] Error resetting admin password:', err.message);
  } finally {
    await closeDB();
    process.exit(0);
  }
};

runReset();
