"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryService = void 0;
const stream_1 = require("stream");
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
class CloudinaryService {
    /**
     * Upload an in-memory buffer to Cloudinary with automatic optimization
     */
    static async uploadBuffer(buffer, folder = 'dukan-bari/general', tags = []) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.default.uploader.upload_stream({
                folder,
                tags: ['dukan-bari', ...tags],
                resource_type: 'image',
                fetch_format: 'auto',
                quality: 'auto',
            }, (error, result) => {
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
            });
            stream_1.Readable.from(buffer).pipe(uploadStream);
        });
    }
    /**
     * Delete an image from Cloudinary by public ID
     */
    static async deleteImage(publicId) {
        try {
            const result = await cloudinary_1.default.uploader.destroy(publicId);
            return result.result === 'ok';
        }
        catch (err) {
            console.error('Failed to delete image from Cloudinary:', err);
            return false;
        }
    }
}
exports.CloudinaryService = CloudinaryService;
