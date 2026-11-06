const express = require('express');
const router = express.Router();
const { Review } = require('../models');
const { optionalAuth } = require('../middleware/auth');

// 1. Get Reviews for Store
router.get('/store/:storeId', async (req, res) => {
  try {
    const reviews = await Review.listByStore(req.params.storeId);
    let average_rating = 5.0;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      average_rating = parseFloat((sum / reviews.length).toFixed(1));
    }
    return res.json({
      success: true,
      count: reviews.length,
      total_reviews: reviews.length,
      average_rating,
      reviews,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Submit Rating & Review
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { store_id, rating, comment, photos, user_id, user_name } = req.body;
    const effectiveUserId = req.user?.id || user_id;
    const effectiveUserName = req.user?.full_name || user_name || 'Verified Customer';

    if (!effectiveUserId) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in to leave a review.' });
    }

    if (!store_id || !rating) {
      return res.status(400).json({ success: false, error: 'store_id and rating (1-5) are required' });
    }

    const review = await Review.create({
      store_id,
      user_id: effectiveUserId,
      user_name: effectiveUserName,
      rating: parseInt(rating, 10),
      comment: comment || '',
      photos: Array.isArray(photos) ? photos : []
    });

    return res.status(201).json({ success: true, review });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

