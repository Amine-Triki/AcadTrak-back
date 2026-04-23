import { z } from 'zod';

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const extractYouTubeId = (value: string) => {
  const trimmed = value.trim();

  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match?.[1] || trimmed;
};

const youtubeIdSchema = z
  .string()
  .trim()
  .transform(extractYouTubeId)
  .refine((value) => YOUTUBE_ID_REGEX.test(value), 'Invalid YouTube video ID');

const cloudinaryAssetSchema = z.object({
  url:      z.string().url(),
  publicId: z.string().min(1),
  bytes:    z.number().optional(),
});

export const lessonSchema = z.object({
  title:       z.string().trim().min(2, 'Title must be at least 2 characters'),
  description: z.string().trim().optional(),
  order:       z.number().int().min(0).optional(),
  isPreview:   z.boolean().optional().default(false),
  isPublished: z.boolean().optional().default(false),

  video: z.object({
    youtubeId: youtubeIdSchema,
    duration:  z.number().min(0).optional(),
  }).optional(),

  pdf:       cloudinaryAssetSchema.optional(),
  thumbnail: cloudinaryAssetSchema.optional(),

}).refine(
  (data) => data.video || data.pdf,
  { message: 'Lesson must have at least a video or a PDF', path: ['video'] },
);

export const updateLessonSchema = lessonSchema.partial();

export type CreateLessonInput = z.infer<typeof lessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;