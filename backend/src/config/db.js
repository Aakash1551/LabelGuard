const mongoose = require('mongoose');

let mongodInstance = null;

/**
 * Connects to MongoDB with strict environment-aware rules:
 * - PRODUCTION: Must connect to persistent MONGODB_URI. Fails startup immediately if unreachable.
 *               MemoryServer fallback is strictly prohibited.
 * - TEST / DEVELOPMENT: Connects to persistent MONGODB_URI if available;
 *                        Allows MongoMemoryServer ONLY when explicitly configured or in test mode.
 */
const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const allowMemoryFallback = isTest || process.env.USE_MEMORY_DB === 'true';

  const uri = process.env.MONGODB_URI || (isProduction ? null : 'mongodb://127.0.0.1:27017/labelguard_db');

  // 1. Production Mode: Absolute strictness
  if (isProduction) {
    if (!process.env.MONGODB_URI) {
      const fatalErr = new Error('[FATAL] MONGODB_URI environment variable is required in production.');
      console.error(fatalErr.message);
      throw fatalErr;
    }

    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`[MongoDB] Connected to production database: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.error(`[FATAL] Production MongoDB connection to ${process.env.MONGODB_URI} failed: ${err.message}`);
      throw err;
    }
  }

  // 2. Non-Production Mode (Development / Test)
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[MongoDB] Connected to database: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    if (allowMemoryFallback) {
      try {
        console.warn(`[MongoDB] Persistent MongoDB at ${uri} unreachable. Starting explicitly permitted MongoMemoryServer (dev/test only)...`);
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create({
          binary: { version: '4.4.18' },
        });
        const memoryUri = mongodInstance.getUri();
        const conn = await mongoose.connect(memoryUri);
        console.log(`[MongoDB] Connected to in-memory database: ${memoryUri}`);
        return conn;
      } catch (memErr) {
        console.error('[MongoDB] Failed to start MongoMemoryServer:', memErr.message);
        throw err;
      }
    } else {
      console.error(`[MongoDB] Connection error to ${uri}. To permit in-memory fallback in dev, set USE_MEMORY_DB=true.`);
      throw err;
    }
  }
};

const closeDB = async () => {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
};

module.exports = { connectDB, closeDB };
