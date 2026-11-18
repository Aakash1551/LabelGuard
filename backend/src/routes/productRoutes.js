const express = require('express');
const { listProducts, createProduct, getProduct } = require('../controllers/productController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, listProducts);
router.post('/', protect, createProduct);
router.get('/:id', protect, getProduct);

module.exports = router;
