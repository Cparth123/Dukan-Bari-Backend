const express = require('express');
const router = express.Router();
const { uploadImage, uploadVideo, uploadMedia } = require('../middleware/upload');
const { uploadToCloudinary } = require('../config/cloudinary');
const { requireAuth } = require('../middleware/auth');

// 1. Upload Single Image (Products, Avatars, Store Banners)
router.post('/image', requireAuth, uploadImage.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const { folder = 'dukan-bari/images' } = req.body;
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resourceType: 'image'
    });

    return res.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
      format: result.format,
      bytes: result.bytes
    });
  } catch (err) {
    console.error('[Upload] Image upload error:', err.message);
    return res.status(500).json({ success: false, error: 'Upload failed: ' + err.message });
  }
});

// 2. Upload Multiple Images (Review Photos, Product Gallery)
router.post('/images', requireAuth, uploadImage.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const { folder = 'dukan-bari/gallery' } = req.body;
    const uploads = await Promise.all(
      req.files.map(file => uploadToCloudinary(file.buffer, { folder, resourceType: 'image' }))
    );

    return res.json({
      success: true,
      count: uploads.length,
      urls: uploads.map(u => u.url),
      uploads
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Upload Video (Product demo videos, Store reels)
router.post('/video', requireAuth, uploadVideo.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file uploaded' });
    }

    const { folder = 'dukan-bari/videos' } = req.body;
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resourceType: 'video'
    });

    return res.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
      format: result.format,
      bytes: result.bytes
    });
  } catch (err) {
    console.error('[Upload] Video upload error:', err.message);
    return res.status(500).json({ success: false, error: 'Video upload failed: ' + err.message });
  }
});

module.exports = router;

