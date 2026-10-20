"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const supabaseStorage_service_1 = require("../services/supabaseStorage.service");
const cloudinary_service_1 = require("../services/cloudinary.service");
const router = (0, express_1.Router)();
// Single file upload route - Uploads directly to Supabase Storage bucket
router.post('/single', auth_1.authenticateUser, upload_1.uploadMiddleware.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No image file uploaded' });
            return;
        }
        const folderType = (req.body.folder || 'general');
        const mimeType = req.file.mimetype || 'image/jpeg';
        try {
            // 1. Primary: Upload to Supabase Storage bucket
            const result = await supabaseStorage_service_1.SupabaseStorageService.uploadBuffer(req.file.buffer, folderType, mimeType);
            res.status(200).json({
                success: true,
                storage: 'supabase',
                message: 'Image uploaded successfully to Supabase Storage basket',
                data: {
                    url: result.publicUrl,
                    filePath: result.filePath,
                    bucket: result.bucket,
                    bytes: result.size,
                }
            });
            return;
        }
        catch (supabaseErr) {
            console.warn('Supabase storage fallback to Cloudinary:', supabaseErr.message);
            // Fallback to Cloudinary if Supabase bucket write permissions hit issue
            const validFolder = folderType === 'stores' ? 'dukan-bari/stores' :
                folderType === 'announcements' ? 'dukan-bari/announcements' :
                    folderType === 'chat' ? 'dukan-bari/chat' :
                        folderType === 'enquiries' ? 'dukan-bari/enquiries' :
                            'dukan-bari/general';
            const tags = [folderType, `user_${req.user?.id}`];
            const result = await cloudinary_service_1.CloudinaryService.uploadBuffer(req.file.buffer, validFolder, tags);
            res.status(200).json({
                success: true,
                storage: 'cloudinary_fallback',
                message: 'Image uploaded to Cloudinary',
                data: {
                    url: result.secureUrl,
                    publicId: result.publicId,
                    format: result.format,
                    bytes: result.bytes
                }
            });
        }
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image',
            error: error.message
        });
    }
});
// Multiple files upload route - Uploads to Supabase Storage bucket
router.post('/multiple', auth_1.authenticateUser, upload_1.uploadMiddleware.array('images', 5), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            res.status(400).json({ success: false, message: 'No images uploaded' });
            return;
        }
        const folderType = (req.body.folder || 'general');
        try {
            const uploadPromises = files.map((file) => supabaseStorage_service_1.SupabaseStorageService.uploadBuffer(file.buffer, folderType, file.mimetype || 'image/jpeg'));
            const results = await Promise.all(uploadPromises);
            res.status(200).json({
                success: true,
                storage: 'supabase',
                message: `${results.length} images uploaded to Supabase Storage basket`,
                data: results.map((r) => ({
                    url: r.publicUrl,
                    filePath: r.filePath,
                    bucket: r.bucket,
                    bytes: r.size
                }))
            });
            return;
        }
        catch (supabaseErr) {
            console.warn('Multiple upload fallback to Cloudinary:', supabaseErr.message);
            const validFolder = folderType === 'stores' ? 'dukan-bari/stores' :
                folderType === 'announcements' ? 'dukan-bari/announcements' :
                    folderType === 'chat' ? 'dukan-bari/chat' :
                        folderType === 'enquiries' ? 'dukan-bari/enquiries' :
                            'dukan-bari/general';
            const uploadPromises = files.map((file) => cloudinary_service_1.CloudinaryService.uploadBuffer(file.buffer, validFolder, [folderType, `user_${req.user?.id}`]));
            const results = await Promise.all(uploadPromises);
            res.status(200).json({
                success: true,
                storage: 'cloudinary_fallback',
                message: `${results.length} images uploaded to Cloudinary`,
                data: results.map((r) => ({
                    url: r.secureUrl,
                    publicId: r.publicId,
                    format: r.format,
                    bytes: r.bytes
                }))
            });
        }
    }
    catch (error) {
        console.error('Multiple upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload images',
            error: error.message
        });
    }
});
exports.default = router;
