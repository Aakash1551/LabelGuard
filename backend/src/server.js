require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const seedRulesAndAdmin = require('./seeds/seedRulesAndAdmin');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await seedRulesAndAdmin();

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
