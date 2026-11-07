const express = require('express');
const router = express.Router();
const { uploadImage, uploadVideo, uploadMedia } = require('../middleware/upload');
const { uploadToCloudinary, deleteFromCloudinary, extractPublicId } = require('../config/cloudinary');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// 1. Upload Single Image (Products, Avatars, Store Banners) - supports Multipart & Base64 JSON
// Automatically overwrites/replaces existing image if existing_url or old_url is passed
router.post('/image', optionalAuth, (req, res, next) => {
  uploadImage.single('file')(req, res, (err) => {
    // If multer error (e.g. content-type application/json), continue to check body
    next();
  });
}, async (req, res) => {
  try {
    let fileBuffer = null;

    if (req.file && req.file.buffer) {
      fileBuffer = req.file.buffer;
    } else if (req.body?.image || req.body?.file || req.body?.base64) {
      const raw = req.body.image || req.body.file || req.body.base64;
      const base64Data = raw.includes(';base64,') ? raw.split(';base64,')[1] : raw;
      fileBuffer = Buffer.from(base64Data, 'base64');
    }

    if (!fileBuffer) {
      return res.status(400).json({ success: false, error: 'No image file or base64 payload provided' });
    }

    const folder = req.body?.folder || req.query?.folder || 'dukan-bari/images';
    const existingUrl = req.body?.existing_url || req.body?.old_url || req.body?.existingUrl || req.body?.oldUrl || req.query?.existing_url || null;
    const publicId = req.body?.public_id || req.body?.publicId || req.query?.public_id || null;

    const result = await uploadToCloudinary(fileBuffer, {
      folder,
      resourceType: 'image',
      existingUrl,
      publicId
    });

    return res.json({
      success: true,
      url: result.url,
      publicId: result.publicId,
      format: result.format,
      bytes: result.bytes,
      overwritten: Boolean(existingUrl || publicId)
    });
  } catch (err) {
    console.error('[Upload] Image upload error:', err.message);
    return res.status(500).json({ success: false, error: 'Upload failed: ' + err.message });
  }
});

// Delete an existing image from Cloudinary
router.delete('/', optionalAuth, async (req, res) => {
  try {
    const urlOrPublicId = req.body?.url || req.body?.image_url || req.body?.public_id || req.query?.url;
    if (!urlOrPublicId) {
      return res.status(400).json({ success: false, error: 'url or public_id parameter is required' });
    }
    const deleted = await deleteFromCloudinary(urlOrPublicId);
    return res.json({ success: true, deleted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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

