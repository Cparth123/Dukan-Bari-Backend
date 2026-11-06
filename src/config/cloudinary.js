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

// Upload buffer directly to Cloudinary (or local fallback)
async function uploadToCloudinary(buffer, { folder = 'dukan-bari', resourceType = 'image' } = {}) {
  if (isConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          transformation: resourceType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : []
        },
        (error, result) => {
          if (error) return reject(error);
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
  isConfigured
};

