import multer from 'multer';

// نخزن في RAM مؤقتاً ثم نرسل لـ Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp',  // صور
    'application/pdf',                          // PDF
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

