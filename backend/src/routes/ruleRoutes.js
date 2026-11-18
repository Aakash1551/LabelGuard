const express = require('express');
const { listRules, getRuleByCode } = require('../controllers/ruleController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, listRules);
router.get('/:code', protect, getRuleByCode);

module.exports = router;
