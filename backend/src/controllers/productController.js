const Product = require('../models/Product');

// @desc    List commodities with search & category filter
// @route   GET /api/v1/products
const listProducts = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 50;
    const { category, search } = req.query;

    const query = {};
    if (category) query.category = category.toUpperCase();
    if (search) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { brand: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const products = await Product.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return res.status(200).json(
      products.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        brand: p.brand || null,
        category: p.category,
        barcode_gtin: p.barcodeGtin || null,
        created_by_id: p.createdBy ? p.createdBy.toString() : null,
        created_at: p.createdAt,
      }))
    );
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Create product entry
// @route   POST /api/v1/products
const createProduct = async (req, res) => {
  try {
    const { name, brand, category, barcode_gtin, barcodeGtin } = req.body;

    if (!name) {
      return res.status(422).json({ detail: 'Product name is required' });
    }

    const product = await Product.create({
      name: name.trim(),
      brand: brand ? brand.trim() : null,
      category: category ? category.toUpperCase() : 'FOOD',
      barcodeGtin: barcode_gtin || barcodeGtin || null,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      id: product._id.toString(),
      name: product.name,
      brand: product.brand || null,
      category: product.category,
      barcode_gtin: product.barcodeGtin || null,
      created_by_id: req.user._id.toString(),
      created_at: product.createdAt,
    });
  } catch (err) {
    return res.status(400).json({ detail: err.message });
  }
};

// @desc    Get single product detail
// @route   GET /api/v1/products/:id
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ detail: 'Product record not found' });
    }

    return res.status(200).json({
      id: product._id.toString(),
      name: product.name,
      brand: product.brand || null,
      category: product.category,
      barcode_gtin: product.barcodeGtin || null,
      created_by_id: product.createdBy ? product.createdBy.toString() : null,
      created_at: product.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

module.exports = { listProducts, createProduct, getProduct };
