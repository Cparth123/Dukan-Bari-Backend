const express = require('express');
const router = express.Router();
const { Product, Store } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

// 1. List Products by Store
router.get('/store/:storeId', async (req, res) => {
  try {
    const products = await Product.listByStore(req.params.storeId);
    return res.json({ success: true, count: products.length, products });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Search Products
router.get('/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const products = await Product.search(q);
    return res.json({ success: true, count: products.length, products });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create Product (Dukandar only)
router.post('/', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const { store_id, name, description, price, offer_price, category, unit, in_stock, image_url, video_url } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ success: false, error: 'Product name and price are required.' });
    }

    // Verify ownership of store
    let targetStoreId = store_id;
    if (!targetStoreId) {
      const myStore = await Store.findByOwnerId(req.user.id);
      if (!myStore) return res.status(400).json({ success: false, error: 'You do not have a registered store.' });
      targetStoreId = myStore.id;
    }

    const product = await Product.create({
      store_id: targetStoreId,
      name,
      description,
      price,
      offer_price,
      category,
      unit,
      in_stock,
      image_url,
      video_url
    });

    return res.status(201).json({ success: true, product });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update Product
router.put('/:id', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    const updated = await Product.update(req.params.id, req.body);
    return res.json({ success: true, product: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Delete Product
router.delete('/:id', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    await Product.delete(req.params.id);
    return res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

