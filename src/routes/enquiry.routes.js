const express = require('express');
const router = express.Router();
const { Enquiry, Store } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getIO } = require('../socket');

// 1. Post Reverse Customer Enquiry
router.post('/', requireAuth, async (req, res) => {
  try {
    const { category, query, description, budget, latitude, longitude, radius_km } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Enquiry query is required' });
    }

    const enquiry = await Enquiry.create({
      customer_id: req.user.id,
      category: category || 'General',
      query,
      description,
      budget,
      latitude: parseFloat(latitude) || 0,
      longitude: parseFloat(longitude) || 0,
      radius_km: parseFloat(radius_km) || 5
    });

    // Broadcast enquiry to merchants via Socket.io
    try {
      const io = getIO();
      io.to('radar').emit('incoming_enquiry', enquiry);
    } catch (e) {}

    return res.status(201).json({ success: true, enquiry });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Customer's Enquiries
router.get('/my', requireAuth, async (req, res) => {
  try {
    const enquiries = await Enquiry.listByCustomer(req.user.id);
    return res.json({ success: true, count: enquiries.length, enquiries });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Nearby Enquiries for Dukandar Radar
router.get('/nearby', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const { lat, lng, radius = 5, category } = req.query;
    const enquiries = await Enquiry.listNearby({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radiusKm: parseFloat(radius),
      category
    });
    return res.json({ success: true, count: enquiries.length, enquiries });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Submit Quote / Bid on Enquiry
router.post('/:id/bid', requireAuth, requireRole('dukandar', 'superadmin'), async (req, res) => {
  try {
    const { message, price, store_id } = req.body;

    let targetStoreId = store_id;
    if (!targetStoreId) {
      const myStore = await Store.findByOwnerId(req.user.id);
      if (!myStore) return res.status(400).json({ success: false, error: 'You do not have a registered store' });
      targetStoreId = myStore.id;
    }

    const response = await Enquiry.addResponse({
      enquiry_id: req.params.id,
      store_id: targetStoreId,
      message,
      price: parseFloat(price) || 0
    });

    // Notify customer via Socket.io
    try {
      const enq = await Enquiry.findById(req.params.id);
      if (enq) {
        const io = getIO();
        io.to(`user:${enq.customer_id}`).emit('new_enquiry_bid', {
          enquiry_id: enq.id,
          bid: response
        });
      }
    } catch (e) {}

    return res.status(201).json({ success: true, response });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get Responses to an Enquiry
router.get('/:id/responses', requireAuth, async (req, res) => {
  try {
    const responses = await Enquiry.listResponses(req.params.id);

    // Hydrate store details for each response
    const hydrated = await Promise.all(
      responses.map(async (r) => {
        const store = await Store.findById(r.store_id);
        return {
          ...r,
          store_name: store?.name || 'Local Store',
          store_rating: store?.rating || 4.5,
          store_phone: store?.phone || ''
        };
      })
    );

    return res.json({ success: true, count: hydrated.length, responses: hydrated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

