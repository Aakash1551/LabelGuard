const express = require('express');
const {
  uploadPackagingImages,
  listInspections,
  getInspection,
} = require('../controllers/inspectionController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.post('/upload', protect, upload.array('files', 10), uploadPackagingImages);
router.get('/', protect, listInspections);
router.get('/:id', protect, getInspection);

module.exports = router;
