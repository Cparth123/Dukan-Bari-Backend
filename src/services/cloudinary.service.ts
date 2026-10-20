import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';
import cloudinary from '../config/cloudinary';

export type CloudinaryFolder = 
  | 'dukan-bari/stores'
  | 'dukan-bari/announcements'
  | 'dukan-bari/chat'
  | 'dukan-bari/enquiries'
  | 'dukan-bari/general';

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

export class CloudinaryService {
  /**
   * Upload an in-memory buffer to Cloudinary with automatic optimization
   */
  public static async uploadBuffer(
    buffer: Buffer,
    folder: CloudinaryFolder = 'dukan-bari/general',
    tags: string[] = []
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          tags: ['dukan-bari', ...tags],
          resource_type: 'image',
          fetch_format: 'auto',
          quality: 'auto',
        },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          if (error || !result) {
            return reject(error || new Error('Cloudinary upload returned undefined result'));
          }

          resolve({
            url: result.url,
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
          });
        }
      );

      Readable.from(buffer).pipe(uploadStream);
    });
  }

  /**
   * Delete an image from Cloudinary by public ID
   */
  public static async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (err) {
      console.error('Failed to delete image from Cloudinary:', err);
      return false;
    }
  }
}
