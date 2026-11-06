const express = require('express');
const router = express.Router();
const { Offer, Store } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getIO } = require('../socket');

// 1. Get Active Offers
router.get('/', async (req, res) => {
  try {
    const offers = await Offer.listActive();

    // Hydrate store info
    const hydrated = await Promise.all(
      offers.map(async (o) => {
        const store = await Store.findById(o.store_id);
        return {
          ...o,
          store_name: store?.name || 'Local Store',
          store_category: store?.category || 'General',
          store_city: store?.city || ''
        };
      })
    );

    return res.json({ success: true, count: hydrated.length, offers: hydrated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Offers by Store
router.get('/store/:storeId', async (req, res) => {
  try {
    const offers = await Offer.listByStore(req.params.storeId);
    return res.json({ success: true, count: offers.length, offers });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create Flash Deal / Offer
router.post('/', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const { store_id, title, description, discount_pct, discount_tag, code, radius_km, is_active, valid_until } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Offer title is required' });
    }

    let targetStoreId = store_id;
    if (!targetStoreId) {
      const myStore = await Store.findByOwnerId(req.user.id);
      if (!myStore) return res.status(400).json({ success: false, error: 'You do not have a registered store' });
      targetStoreId = myStore.id;
    }

    const offer = await Offer.create({
      store_id: targetStoreId,
      title,
      description,
      discount_tag: discount_tag || (discount_pct ? `${discount_pct}% OFF` : 'FLAT 20% OFF'),
      discount_pct,
      radius_km: radius_km !== undefined ? parseFloat(radius_km) : 5.0,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      code,
      valid_until
    });

    // Broadcast new offer to radar
    try {
      const io = getIO();
      io.to('radar').emit('new_flash_offer', offer);
    } catch (e) {}

    return res.status(201).json({ success: true, offer });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update Offer
router.put('/:id', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const { title, description, discount_tag, discount_pct, radius_km, is_active, valid_until } = req.body;
    const existing = await Offer.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Offer not found' });
    }

    const updated = await Offer.update(req.params.id, {
      title,
      description,
      discount_tag: discount_tag || (discount_pct ? `${discount_pct}% OFF` : undefined),
      radius_km,
      is_active,
      valid_until
    });

    return res.json({ success: true, offer: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Delete Offer
router.delete('/:id', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    await Offer.delete(req.params.id);
    return res.json({ success: true, message: 'Offer deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

