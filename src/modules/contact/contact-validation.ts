import { z } from 'zod';

const booleanLikeSchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export const createContactMessageSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(80, 'First name is too long'),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters').max(80, 'Last name is too long'),
  email: z.email('Invalid email address').transform((value) => value.trim().toLowerCase()),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(150, 'Subject is too long'),
  message: z.string().trim().min(20, 'Message must be at least 20 characters').max(5000, 'Message is too long'),
});

export const listContactMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  unreadOnly: booleanLikeSchema.optional().default(false),
  includeArchived: booleanLikeSchema.optional().default(false),
});

export const updateContactMessageReadSchema = z.object({
  isRead: z.boolean(),
});

export const updateContactMessageArchiveSchema = z.object({
  isArchived: z.boolean(),
});

export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;
export type ListContactMessagesQueryInput = z.infer<typeof listContactMessagesQuerySchema>;
export type UpdateContactMessageReadInput = z.infer<typeof updateContactMessageReadSchema>;
export type UpdateContactMessageArchiveInput = z.infer<typeof updateContactMessageArchiveSchema>;
