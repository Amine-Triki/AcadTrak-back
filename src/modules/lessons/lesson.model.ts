import { Schema, model, Types, type HydratedDocument } from 'mongoose';

// ── YouTube Video ──────────────────────────────
interface IYouTubeVideo {
  youtubeId:  string;   // مثال: "dQw4w9WgXcQ"
  duration?:  number;   // بالثواني
}

// ── Cloudinary Asset ───────────────────────────
interface ICloudinaryAsset {
  url:      string;
  publicId: string;
  bytes?:   number;
}

// ── Lesson ─────────────────────────────────────
export interface ILesson {
  course:       Types.ObjectId;
  title:        string;
  description?: string;
  order:        number;           // ترتيب الدرس في الكورس

  // ✅ كل حقل اختياري — يمكن أن يكون أي مزيج
  video?:       IYouTubeVideo;    // فيديو YouTube
  pdf?:         ICloudinaryAsset; // ملف PDF
  thumbnail?:   ICloudinaryAsset; // صورة

  isPreview:    boolean;          // درس مجاني للمعاينة
  isPublished:  boolean;
}

export type LessonDocument = HydratedDocument<ILesson>;

const cloudinaryAssetSchema = new Schema<ICloudinaryAsset>(
  {
    url:      { type: String, required: true },
    publicId: { type: String, required: true },
    bytes:    { type: Number },
  },
  { _id: false }, // لا نحتاج _id لكل asset
);

const lessonSchema = new Schema<ILesson>(
  {
    course:      { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title:       { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    order:       { type: Number, required: true, default: 0 },

    // فيديو YouTube — اختياري
    video: {
      youtubeId: { type: String, trim: true },
      duration:  { type: Number, min: 0 },
    },

    // PDF — اختياري
    pdf: { type: cloudinaryAssetSchema },

    // صورة — اختيارية
    thumbnail: { type: cloudinaryAssetSchema },

    isPreview:   { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ترتيب الدروس داخل الكورس
lessonSchema.index({ course: 1, order: 1 });

// ✅ validation: يجب أن يكون فيه على الأقل فيديو أو PDF
lessonSchema.pre('validate', function (this: LessonDocument) {
  const hasVideo = Boolean(this.video?.youtubeId);
  const hasPdf   = Boolean(this.pdf?.url);

  if (!hasVideo && !hasPdf) {
    this.invalidate('video', 'Lesson must have at least a YouTube video or a PDF');
  }
});

export const Lesson = model<ILesson>('Lesson', lessonSchema);