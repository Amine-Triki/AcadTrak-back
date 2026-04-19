import { Schema, model, type HydratedDocument } from 'mongoose';

export interface IContactMessage {
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  readAt?: Date | null;
  isArchived: boolean;
  archivedAt?: Date | null;
  contentHash: string;
  idempotencyKey?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ContactMessageDocument = HydratedDocument<IContactMessage>;

const contactMessageSchema = new Schema<IContactMessage>({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  isArchived: { type: Boolean, default: false, index: true },
  archivedAt: { type: Date, default: null },
  contentHash: { type: String, required: true, index: true },
  idempotencyKey: { type: String, trim: true },
  ipAddress: { type: String, trim: true },
  userAgent: { type: String, trim: true },
}, { timestamps: true });

contactMessageSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
contactMessageSchema.index({ email: 1, contentHash: 1, createdAt: -1 });
contactMessageSchema.index({ isArchived: 1, isRead: 1, createdAt: -1 });

export const ContactMessage = model<IContactMessage>('ContactMessage', contactMessageSchema);
