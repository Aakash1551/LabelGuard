const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const ruleRoutes = require('./routes/ruleRoutes');
const inspectionRoutes = require('./routes/inspectionRoutes');
const { checkAIHealth } = require('./services/aiService');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploaded images
app.use('/uploads', express.static(path.resolve('uploads')));

// Health & Diagnostic endpoint
app.get('/api/v1/health', async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const aiHealth = await checkAIHealth();

  return res.status(200).json({
    status: 'online',
    app_name: 'LabelGuard AI (Node.js/Express Backend)',
    environment: process.env.NODE_ENV || 'development',
    database: isDbConnected ? 'healthy' : 'disconnected',
    ai_service: aiHealth,
    version: '1.0.0',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  return res.status(200).json({
    platform: 'LabelGuard AI',
    purpose: 'Packaged Commodity Compliance Intelligence Platform',
    stack: 'MERN + Python AI Microservice',
    health: '/api/v1/health',
  });
});

// Mount V1 API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/rules', ruleRoutes);
app.use('/api/v1/inspections', inspectionRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('[Express Error]:', err.message);
  return res.status(err.status || 400).json({
    detail: err.message || 'An error occurred during request processing',
  });
});

module.exports = app;
