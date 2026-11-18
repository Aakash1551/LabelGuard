const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

// Memory storage allows binary magic-byte inspection before writing to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      new Error(`Unsupported file format '${ext}'. Only JPG, PNG, and WebP are allowed.`),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

/**
 * Validates binary signature (magic bytes) from an in-memory buffer.
 */
const validateMagicBytes = (buffer, filename) => {
  if (!buffer || buffer.length < 12) {
    throw new Error(`File '${filename}' is empty or too small.`);
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isWebp =
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    throw new Error(`Invalid file content signature for '${filename}'. File is corrupted or spoofed.`);
  }

  if (isJpeg) return 'image/jpeg';
  if (isPng) return 'image/png';
  return 'image/webp';
};

module.exports = { upload, validateMagicBytes };
