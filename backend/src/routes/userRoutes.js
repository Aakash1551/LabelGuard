const express = require('express');
const { listUsers, updateUser } = require('../controllers/userController');
const { protect, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, requireAdmin, listUsers);
router.put('/:id', protect, requireAdmin, updateUser);

module.exports = router;
