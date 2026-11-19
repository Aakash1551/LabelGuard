const mongoose = require('mongoose');

let mongodInstance = null;

/**
 * Safely extracts the hostname from a MongoDB URI for diagnostic logging.
 * Never logs credentials, full URIs, usernames or passwords.
 */
const getSafeHostname = (uri) => {
  if (!uri) return '(none)';
  try {
    // mongodb+srv:// URIs need conversion for URL parsing
    const parseable = uri.replace(/^mongodb(\+srv)?:\/\//, 'http://');
    return new URL(parseable).hostname || '(unknown)';
  } catch {
    return '(unparseable)';
  }
};

/**
 * Connects to MongoDB with strict environment-aware rules:
 * - PRODUCTION: Must connect to persistent MONGODB_URI. Fails startup immediately if unreachable.
 *               MemoryServer fallback is strictly prohibited.
 * - TEST / DEVELOPMENT: Connects to persistent MONGODB_URI if available;
 *                        Allows MongoMemoryServer ONLY when explicitly configured or in test mode.
 *
 * Accepts MONGODB_URI (preferred) or DATABASE_URL (legacy fallback).
 */
const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const allowMemoryFallback = isTest || process.env.USE_MEMORY_DB === 'true';

  // Accept both MONGODB_URI (preferred) and DATABASE_URL (legacy) for backward compatibility
  const configuredUri = process.env.MONGODB_URI || process.env.DATABASE_URL || null;

  // Startup diagnostic — log only hostname, never credentials or full URI
  const resolvedSource = process.env.MONGODB_URI
    ? 'MONGODB_URI'
    : process.env.DATABASE_URL
      ? 'DATABASE_URL'
      : '(not set)';

  console.log(`[MongoDB] URI source: ${resolvedSource}, target host: ${getSafeHostname(configuredUri)}`);

  const uri = configuredUri || (isProduction ? null : 'mongodb://127.0.0.1:27017/labelguard_db');

  // 1. Production Mode: Absolute strictness
  if (isProduction) {
    if (!configuredUri) {
      const fatalErr = new Error(
        '[FATAL] MONGODB_URI (or DATABASE_URL) environment variable is required in production. ' +
        'In-memory database fallback is prohibited in production.'
      );
      console.error(fatalErr.message);
      throw fatalErr;
    }

    try {
      const conn = await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`[MongoDB] Connected to production database at host: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      // Log only the hostname, never the full URI which contains credentials
      console.error(`[FATAL] Production MongoDB connection to host ${getSafeHostname(configuredUri)} failed: ${err.message}`);
      throw err;
    }
  }

  // 2. Non-Production Mode (Development / Test)
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[MongoDB] Connected to database at host: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    if (allowMemoryFallback) {
      try {
        console.warn(`[MongoDB] Persistent MongoDB at host ${getSafeHostname(uri)} unreachable. Starting explicitly permitted MongoMemoryServer (dev/test only)...`);
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create({
          binary: { version: '4.4.18' },
        });
        const memoryUri = mongodInstance.getUri();
        const conn = await mongoose.connect(memoryUri);
        console.log(`[MongoDB] Connected to in-memory database (dev/test only).`);
        return conn;
      } catch (memErr) {
        console.error('[MongoDB] Failed to start MongoMemoryServer:', memErr.message);
        throw err;
      }
    } else {
      console.error(`[MongoDB] Connection to host ${getSafeHostname(uri)} failed. To permit in-memory fallback in dev, set USE_MEMORY_DB=true.`);
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
