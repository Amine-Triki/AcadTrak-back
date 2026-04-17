import cloudinary from '../config/cloudinary.js';
import type { UploadApiResponse } from 'cloudinary';

export type ResourceType = 'image' | 'raw'; // raw = PDF

export interface CloudinaryUploadResult {
  url:       string;
  publicId:  string;
  format:    string;
  bytes:     number;
}

// رفع ملف من buffer (بعد multer)
export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
  resourceType: ResourceType = 'image',
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        // PDF: حفظه كـ raw
        // Image: ضغط تلقائي
        ...(resourceType === 'image' && {
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        }),
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'));
        resolve({
          url:      result.secure_url,
          publicId: result.public_id,
          format:   result.format,
          bytes:    result.bytes,
        });
      },
    );
    stream.end(buffer);
  });
};

// حذف ملف من Cloudinary
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: ResourceType = 'image',
) => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
};