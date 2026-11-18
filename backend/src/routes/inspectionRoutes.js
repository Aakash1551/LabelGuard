const express = require('express');
const {
  uploadPackagingImages,
  listInspections,
  getInspection,
  getInspectionDeclarations,
  triggerExtraction,
} = require('../controllers/inspectionController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.post('/upload', protect, upload.array('files', 10), uploadPackagingImages);
router.get('/', protect, listInspections);
router.get('/:id', protect, getInspection);
router.get('/:id/declarations', protect, getInspectionDeclarations);
router.post('/:id/extract', protect, triggerExtraction);

module.exports = router;
