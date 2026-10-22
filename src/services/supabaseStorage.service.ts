import { supabaseAdmin } from '../config/supabase';
import { config } from '../config/env';

export type StorageFolder = 'stores' | 'products' | 'chat' | 'announcements' | 'profiles' | 'enquiries' | 'general';

export class SupabaseStorageService {
  private static defaultBucket = config.supabase.storageBucket || 'dukan-bari-storage';
  private static initializedBuckets = new Set<string>();

  /**
   * Ensures the target bucket exists and is public.
   */
  public static async ensureBucketExists(bucketName: string = this.defaultBucket): Promise<void> {
    if (this.initializedBuckets.has(bucketName)) {
      return;
    }

    try {
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

      if (listError) {
        console.warn(`[Supabase Storage] Notice listing buckets: ${listError.message}`);
      }

      const bucketExists = buckets?.some((b) => b.name === bucketName);

      if (!bucketExists) {
        console.log(`[Supabase Storage] Creating public bucket '${bucketName}'...`);
        const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
        });

        if (createError && !createError.message.includes('already exists')) {
          console.error(`[Supabase Storage] Failed to create bucket: ${createError.message}`);
        } else {
          console.log(`[Supabase Storage] Bucket '${bucketName}' ready (public).`);
        }
      }

      this.initializedBuckets.add(bucketName);
    } catch (err: any) {
      console.warn(`[Supabase Storage] Bucket initialization check: ${err.message}`);
    }
  }

  /**
   * Upload an image buffer directly to Supabase Storage bucket.
   */
  public static async uploadBuffer(
    buffer: Buffer,
    folder: StorageFolder = 'general',
    mimeType: string = 'image/jpeg',
    customFileName?: string,
    bucketName: string = this.defaultBucket
  ): Promise<{ publicUrl: string; filePath: string; bucket: string; size: number }> {
    await this.ensureBucketExists(bucketName);

    // Generate unique file path
    const extension = mimeType.split('/')[1] || 'jpg';
    const cleanExtension = extension === 'jpeg' ? 'jpg' : extension;
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const fileName = customFileName || `${Date.now()}-${randomSuffix}.${cleanExtension}`;
    const filePath = `${folder}/${fileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const { data: urlData } = supabaseAdmin.storage
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
