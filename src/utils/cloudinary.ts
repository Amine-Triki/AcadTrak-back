import cloudinary from '../config/cloudinary.js';
import type { UploadApiResponse } from 'cloudinary';

export type ResourceType = 'image' | 'raw';

export interface CloudinaryUploadResult {
  url:       string;
  publicId:  string;
  format:    string;
  bytes:     number;
}

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
        ...(resourceType === 'image' && {
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        }),
        // ✅ Fix PDF: احفظ الملف بامتداد .pdf ليُحمَّل بشكل صحيح
        ...(resourceType === 'raw' && {
          format: 'pdf',
          use_filename: false,
        }),
      },
      (error, result: UploadApiResponse | undefined) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'));

        // ✅ أضف fl_attachment لـ URL التحميل — يجبر المتصفح على تحميله كـ PDF
        const downloadUrl = resourceType === 'raw'
          ? result.secure_url.replace('/upload/', '/upload/fl_attachment/')
          : result.secure_url;

        resolve({
          url:      downloadUrl,
          publicId: result.public_id,
          format:   result.format,
          bytes:    result.bytes,
        });
      },
    );
    stream.end(buffer);
  });
};

export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: ResourceType = 'image',
) => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
};