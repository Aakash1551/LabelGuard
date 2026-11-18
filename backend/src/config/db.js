const mongoose = require('mongoose');

let mongodInstance = null;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/labelguard_db';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[MongoDB] Connected to database: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    // If local MongoDB daemon is not running and we are in dev/test, fallback to in-memory server
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.warn(`[MongoDB] Local daemon not reachable at ${uri}. Launching embedded MongoMemoryServer for development...`);
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create({
          binary: { version: '4.4.18' }
        });
        const memoryUri = mongodInstance.getUri();
        const conn = await mongoose.connect(memoryUri);
        console.log(`[MongoDB] Connected to embedded in-memory database: ${memoryUri}`);
        return conn;
      } catch (memErr) {
        console.error('[MongoDB] Failed to start embedded MongoDB:', memErr.message);
        throw err;
      }
    } else {
      console.error('[MongoDB] Connection error:', err.message);
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
