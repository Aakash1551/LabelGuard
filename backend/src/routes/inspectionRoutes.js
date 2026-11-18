const express = require('express');
const {
  uploadPackagingImages,
  listInspections,
  getInspectionStats,
  getInspection,
  getInspectionDeclarations,
  triggerExtraction,
} = require('../controllers/inspectionController');
const {
  evaluateCompliance,
  getComplianceSummary,
  getInspectionFindings,
  overrideCompliance,
} = require('../controllers/complianceController');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.post('/upload', protect, upload.array('files', 10), uploadPackagingImages);
router.get('/', protect, listInspections);
router.get('/stats', protect, getInspectionStats);
router.get('/:id', protect, getInspection);
router.get('/:id/declarations', protect, getInspectionDeclarations);
router.post('/:id/extract', protect, triggerExtraction);

// Phase 6 Compliance Engine Endpoints
router.post('/:id/evaluate', protect, evaluateCompliance);
router.get('/:id/compliance', protect, getComplianceSummary);
router.get('/:id/findings', protect, getInspectionFindings);
router.put('/:id/override', protect, overrideCompliance);

module.exports = router;
