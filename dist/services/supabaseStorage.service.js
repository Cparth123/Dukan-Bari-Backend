"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseStorageService = void 0;
const supabase_1 = require("../config/supabase");
const env_1 = require("../config/env");
class SupabaseStorageService {
    static defaultBucket = env_1.config.supabase.storageBucket || 'dukan-bari-storage';
    static initializedBuckets = new Set();
    /**
     * Ensures the target bucket exists and is public.
     */
    static async ensureBucketExists(bucketName = this.defaultBucket) {
        if (this.initializedBuckets.has(bucketName)) {
            return;
        }
        try {
            const { data: buckets, error: listError } = await supabase_1.supabaseAdmin.storage.listBuckets();
            if (listError) {
                console.warn(`[Supabase Storage] Notice listing buckets: ${listError.message}`);
            }
            const bucketExists = buckets?.some((b) => b.name === bucketName);
            if (!bucketExists) {
                console.log(`[Supabase Storage] Creating public bucket '${bucketName}'...`);
                const { error: createError } = await supabase_1.supabaseAdmin.storage.createBucket(bucketName, {
                    public: true,
                    fileSizeLimit: 10485760, // 10MB
                    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
                });
                if (createError && !createError.message.includes('already exists')) {
                    console.error(`[Supabase Storage] Failed to create bucket: ${createError.message}`);
                }
                else {
                    console.log(`[Supabase Storage] Bucket '${bucketName}' ready (public).`);
                }
            }
            this.initializedBuckets.add(bucketName);
        }
        catch (err) {
            console.warn(`[Supabase Storage] Bucket initialization check: ${err.message}`);
        }
    }
    /**
     * Upload an image buffer directly to Supabase Storage bucket.
     */
    static async uploadBuffer(buffer, folder = 'general', mimeType = 'image/jpeg', customFileName, bucketName = this.defaultBucket) {
        await this.ensureBucketExists(bucketName);
        // Generate unique file path
        const extension = mimeType.split('/')[1] || 'jpg';
        const cleanExtension = extension === 'jpeg' ? 'jpg' : extension;
        const randomSuffix = Math.random().toString(36).substring(2, 9);
        const fileName = customFileName || `${Date.now()}-${randomSuffix}.${cleanExtension}`;
        const filePath = `${folder}/${fileName}`;
        const { data, error } = await supabase_1.supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, buffer, {
            contentType: mimeType,
            upsert: true
        });
        if (error) {
            throw new Error(`Supabase Storage upload failed: ${error.message}`);
        }
        const { data: urlData } = supabase_1.supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(filePath);
        return {
            publicUrl: urlData.publicUrl,
            filePath: data.path,
            bucket: bucketName,
            size: buffer.length
        };
    }
}
exports.SupabaseStorageService = SupabaseStorageService;
