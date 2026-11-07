const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

const isConfigured = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);

if (isConfigured) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log(`[Cloudinary] Connected to Cloudinary (${CLOUDINARY_CLOUD_NAME})`);
} else {
  console.log('[Cloudinary] Notice: Cloudinary credentials not set in .env. Running local file upload fallback.');
}

// Extract public_id from a Cloudinary URL string
function extractPublicId(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('cloudinary.com')) return null;
  // Match path after /upload/ (optional /v12345/) up to extension
  const match = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
  return match ? match[1] : null;
}

// Delete an asset from Cloudinary
async function deleteFromCloudinary(urlOrPublicId, resourceType = 'image') {
  if (!isConfigured || !urlOrPublicId) return false;
  try {
    const publicId = extractPublicId(urlOrPublicId) || urlOrPublicId;
    if (!publicId) return false;
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true
    });
    console.log(`[Cloudinary] Deleted asset: ${publicId} (result: ${res.result})`);
    return res.result === 'ok';
  } catch (err) {
    console.warn('[Cloudinary] Delete notice:', err.message);
    return false;
  }
}

// Upload buffer directly to Cloudinary (or local fallback)
// If existingUrl, oldUrl, or publicId is passed, OVERWRITES/REPLACES in place instead of creating duplicates
async function uploadToCloudinary(buffer, {
  folder = 'dukan-bari',
  resourceType = 'image',
  existingUrl = null,
  oldUrl = null,
  publicId = null,
  overwrite = true,
  invalidate = true
} = {}) {
  const targetPublicId = publicId || extractPublicId(existingUrl || oldUrl);

  if (isConfigured) {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: resourceType,
        transformation: resourceType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : []
      };

      if (targetPublicId) {
        // Overwrite existing asset in place with the same publicId
        uploadOptions.public_id = targetPublicId;
        uploadOptions.overwrite = true;
        uploadOptions.invalidate = true;
      } else {
        uploadOptions.folder = folder;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          console.log(`[Cloudinary] ${targetPublicId ? 'Replaced/Overwritten' : 'Uploaded'} asset: ${result.public_id}`);
          resolve({
            url: result.secure_url || result.url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            bytes: result.bytes
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Local fallback: Save to backend/uploads folder
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = resourceType === 'video' ? 'mp4' : 'jpg';
  const filename = `${resourceType}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const filepath = path.join(uploadsDir, filename);

  fs.writeFileSync(filepath, buffer);
  const localUrl = `/uploads/${filename}`;

  return {
    url: localUrl,
    publicId: filename,
    resourceType,
    format: ext,
    bytes: buffer.length
  };
}

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicId,
  isConfigured
};

