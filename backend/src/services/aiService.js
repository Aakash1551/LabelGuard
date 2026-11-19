const axios = require('axios');
const path = require('path');

const getAiServiceUrl = () => process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';

/**
 * Invokes Python AI microservice to run OpenCV preprocessing and RapidOCR
 * on an uploaded packaging image file.
 */
const processImageWithAI = async (rawImagePath, prepImagePath) => {
  const absoluteRawPath = path.resolve(rawImagePath);
  const absolutePrepPath = path.resolve(prepImagePath);

  try {
    const response = await axios.post(
      `${getAiServiceUrl()}/api/v1/process-image`,
      {
        image_path: absoluteRawPath,
        output_path: absolutePrepPath,
      },
      { timeout: 30000 }
    );

    return response.data;
  } catch (err) {
    console.error(`[AIService] Failed to process image ${rawImagePath}:`, err.message);
    // Return safe fallback so inspection creation does not fail
    return {
      success: false,
      error: err.message,
      original_width: null,
      original_height: null,
      processed_width: null,
      processed_height: null,
      tokens: [],
      declarations: [],
    };
  }
};

const extractDeclarationsFromTokens = async (tokens) => {
  try {
    const response = await axios.post(
      `${getAiServiceUrl()}/api/v1/extract-declarations`,
      { tokens },
      { timeout: 15000 }
    );
    return response.data;
  } catch (err) {
    console.error('[AIService] Failed to extract declarations from tokens:', err.message);
    return {
      success: false,
      error: err.message,
      declarations: [],
    };
  }
};

const checkAIHealth = async () => {
  try {
    const res = await axios.get(`${getAiServiceUrl()}/health`, { timeout: 3000 });
    return res.data;
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
};

module.exports = { processImageWithAI, extractDeclarationsFromTokens, checkAIHealth };
