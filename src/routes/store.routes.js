const express = require('express');
const router = express.Router();
const { Store, Product, Review } = require('../models');
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');
const { getIO } = require('../socket');

// 1. Hyperlocal Store Discovery Radar
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius = 5, category, is_live_open, owner_id } = req.query;

    if (owner_id) {
      const store = await Store.findByOwnerId(owner_id);
      return res.json({ success: true, count: store ? 1 : 0, stores: store ? [store] : [] });
    }

    if (lat && lng) {
      const stores = await Store.findNearby({
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radiusKm: parseFloat(radius),
        category
      });
      return res.json({ success: true, count: stores.length, stores });
    }

    const stores = await Store.list({
      category,
      is_live_open: is_live_open !== undefined ? is_live_open === 'true' : undefined
    });
    return res.json({ success: true, count: stores.length, stores });
  } catch (err) {
    console.error('[Store] List error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Single Store Details & Catalog
router.get('/:id', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const products = await Product.listByStore(store.id);
    const reviews = await Review.listByStore(store.id);

    return res.json({
      success: true,
      store: {
        ...store,
        products,
        reviews
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create or Update Store (Dukandar only)
router.post('/', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    let store = null;
    const storeId = req.body.id;
    if (storeId) {
      store = await Store.findById(storeId);
    }
    if (!store && req.user.id) {
      store = await Store.findByOwnerId(req.user.id);
    }

    if (store) {
      // UPDATE existing store! Do NOT create a duplicate row!
      const updated = await Store.update(store.id, req.body);
      return res.json({ success: true, store: updated });
    }

    const storeData = {
      ...req.body,
      owner_id: req.user.id
    };
    const newStore = await Store.create(storeData);
    return res.status(201).json({ success: true, store: newStore });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update Store Profile
router.put('/:id', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

    if (req.user.role !== 'superadmin' && store.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You are not authorized to edit this store' });
    }

    const updated = await Store.update(req.params.id, req.body);

    if (req.body.is_live_open !== undefined) {
      try {
        const io = getIO();
        const payload = {
          storeId: String(req.params.id),
          store_id: String(req.params.id),
          is_live_open: Boolean(req.body.is_live_open),
          isLiveOpen: Boolean(req.body.is_live_open)
        };
        io.emit('store_status_changed', payload);
        io.to('radar').emit('store_status_changed', payload);
        io.to(`store:${req.params.id}`).emit('store_status_changed', payload);
      } catch (e) {}
    }

    return res.json({ success: true, store: updated, is_live_open: updated?.is_live_open ?? true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Toggle Live Open / Closed Status
router.patch('/:id/status', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const { is_live_open } = req.body;
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

    if (req.user.role !== 'superadmin' && store.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized to change store live status' });
    }

    const updated = await Store.toggleLiveStatus(req.params.id, Boolean(is_live_open));

    // Broadcast change via Socket.io to all clients
    try {
      const io = getIO();
      const payload = {
        storeId: String(store.id),
        store_id: String(store.id),
        is_live_open: Boolean(is_live_open),
        isLiveOpen: Boolean(is_live_open)
      };
      io.emit('store_status_changed', payload);
      io.to('radar').emit('store_status_changed', payload);
      io.to(`store:${store.id}`).emit('store_status_changed', payload);
    } catch (e) {}

    return res.json({ success: true, store: updated, is_live_open: Boolean(is_live_open) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Delete Store
router.delete('/:id', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: 'Store not found' });

    if (req.user.role !== 'superadmin' && store.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Unauthorized to delete this store' });
    }

    await Store.delete(req.params.id);
    return res.json({ success: true, message: 'Store deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

