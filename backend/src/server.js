require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const seedRulesAndAdmin = require('./seeds/seedRulesAndAdmin');
const { checkAIHealth } = require('./services/aiService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedRulesAndAdmin();

    const aiHealth = await checkAIHealth();
    if (aiHealth.status === 'online') {
      console.log(`[Server] Python AI Microservice: ONLINE (${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'})`);
    } else {
      console.warn(`[Server] WARNING: Python AI Microservice is OFFLINE (${aiHealth.error}). Start it on port 8001 for OCR.`);
    }

    app.listen(PORT, () => {
      console.log(`[Server] LabelGuard Node.js/Express backend running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
};

startServer();
