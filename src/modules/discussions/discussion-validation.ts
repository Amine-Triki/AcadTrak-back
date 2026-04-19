import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

export const createDiscussionSchema = z.object({
  course: objectIdSchema,
  lesson: objectIdSchema.optional(),
  question: z.string().trim().min(3, 'Question must be at least 3 characters').max(2000, 'Question is too long'),
});

export const updateDiscussionSchema = z.object({
  lesson: objectIdSchema.optional(),
  question: z.string().trim().min(3, 'Question must be at least 3 characters').max(2000, 'Question is too long').optional(),
}).superRefine((payload, ctx) => {
  if (Object.keys(payload).length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'At least one field is required for update',
    });
  }
});

export const answerDiscussionSchema = z.object({
  answer: z.string().trim().min(1, 'Answer is required').max(3000, 'Answer is too long'),
});

export type CreateDiscussionInput = z.infer<typeof createDiscussionSchema>;
export type UpdateDiscussionInput = z.infer<typeof updateDiscussionSchema>;
export type AnswerDiscussionInput = z.infer<typeof answerDiscussionSchema>;
