require('dotenv').config();
const { cloudinary, isConfigured, uploadToCloudinary } = require('../config/cloudinary');

async function testCloudinary() {
  console.log('Testing Cloudinary Credentials:');
  console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('API Key:', process.env.CLOUDINARY_API_KEY ? 'Present (' + process.env.CLOUDINARY_API_KEY.slice(-4) + ')' : 'Missing');
  console.log('Is Configured:', isConfigured);

  try {
    const pingResult = await cloudinary.api.ping();
    console.log('✓ Cloudinary API Ping Successful:', pingResult);

    // Test buffer upload
    const dummyImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const uploadResult = await uploadToCloudinary(dummyImageBuffer, {
      folder: 'dukan-bari/test',
      resourceType: 'image'
    });
    console.log('✓ Live Upload Successful!');
    console.log('  URL:', uploadResult.url);
    console.log('  Public ID:', uploadResult.publicId);
  } catch (err) {
    console.error('❌ Cloudinary Error:', err.message);
  }
}

testCloudinary();

