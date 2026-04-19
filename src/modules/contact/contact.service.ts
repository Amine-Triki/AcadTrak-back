import { createHash } from 'crypto';
import type { ServiceResult } from '../../types/index.js';
import { isValidObjectId } from '../../utils/mongo.js';
import { ContactMessage } from './contact.model.js';
import type {
  CreateContactMessageInput,
  ListContactMessagesQueryInput,
  UpdateContactMessageArchiveInput,
  UpdateContactMessageReadInput,
} from './contact-validation.js';

const DEDUP_WINDOW_MS = 60 * 1000;

type ContactRequestMeta = {
  idempotencyKey?: string;
  ipAddress?: string;
  userAgent?: string;
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildContentHash = (payload: CreateContactMessageInput) => {
  const normalized = [
    normalizeText(payload.firstName).toLowerCase(),
    normalizeText(payload.lastName).toLowerCase(),
    payload.email.trim().toLowerCase(),
    normalizeText(payload.subject).toLowerCase(),
    normalizeText(payload.message),
  ].join('|');

  return createHash('sha256').update(normalized).digest('hex');
};

const isDuplicateIdempotencyError = (error: unknown) => {
  const err = error as { code?: number; message?: string };
  return err.code === 11000 && Boolean(err.message?.includes('idempotencyKey_1'));
};

const toContactMessageResponse = (message: {
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  readAt?: Date | null;
  isArchived: boolean;
  archivedAt?: Date | null;
  ipAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) => ({
  id: String(message._id),
  firstName: message.firstName,
  lastName: message.lastName,
  email: message.email,
  subject: message.subject,
  message: message.message,
  isRead: message.isRead,
  readAt: message.readAt || null,
  isArchived: message.isArchived,
  archivedAt: message.archivedAt || null,
  ipAddress: message.ipAddress || null,
  userAgent: message.userAgent || null,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

export const listContactMessages = async (
  query: ListContactMessagesQueryInput,
): Promise<ServiceResult> => {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const normalizedSearch = query.search?.trim();
  const filter: Record<string, unknown> = {
    ...(query.includeArchived ? {} : { isArchived: false }),
    ...(query.unreadOnly ? { isRead: false } : {}),
    ...(normalizedSearch
      ? {
          $or: [
            { firstName: { $regex: normalizedSearch, $options: 'i' } },
            { lastName: { $regex: normalizedSearch, $options: 'i' } },
            { email: { $regex: normalizedSearch, $options: 'i' } },
            { subject: { $regex: normalizedSearch, $options: 'i' } },
            { message: { $regex: normalizedSearch, $options: 'i' } },
          ],
        }
      : {}),
  };

  const [messages, total] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id firstName lastName email subject message isRead readAt isArchived archivedAt ipAddress userAgent createdAt updatedAt'),
    ContactMessage.countDocuments(filter),
  ]);

  return {
    statusCode: 200,
    data: {
      messages: messages.map(toContactMessageResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
};

export const updateContactMessageReadStatus = async (
  contactMessageId: string,
  payload: UpdateContactMessageReadInput,
): Promise<ServiceResult> => {
  if (!isValidObjectId(contactMessageId)) {
    return { statusCode: 400, data: { message: 'Invalid message id' } };
  }

  const updated = await ContactMessage.findByIdAndUpdate(
    contactMessageId,
    {
      isRead: payload.isRead,
      readAt: payload.isRead ? new Date() : null,
    },
    { new: true },
  ).select('_id firstName lastName email subject message isRead readAt isArchived archivedAt ipAddress userAgent createdAt updatedAt');

  if (!updated) {
    return { statusCode: 404, data: { message: 'Message not found' } };
  }

  return {
    statusCode: 200,
    data: {
      message: payload.isRead ? 'Message marked as read' : 'Message marked as unread',
      contactMessage: toContactMessageResponse(updated),
    },
  };
};

export const updateContactMessageArchiveStatus = async (
  contactMessageId: string,
  payload: UpdateContactMessageArchiveInput,
): Promise<ServiceResult> => {
  if (!isValidObjectId(contactMessageId)) {
    return { statusCode: 400, data: { message: 'Invalid message id' } };
  }

  const updated = await ContactMessage.findByIdAndUpdate(
    contactMessageId,
    {
      isArchived: payload.isArchived,
      archivedAt: payload.isArchived ? new Date() : null,
    },
    { new: true },
  ).select('_id firstName lastName email subject message isRead readAt isArchived archivedAt ipAddress userAgent createdAt updatedAt');

  if (!updated) {
    return { statusCode: 404, data: { message: 'Message not found' } };
  }

  return {
    statusCode: 200,
    data: {
      message: payload.isArchived ? 'Message archived' : 'Message restored',
      contactMessage: toContactMessageResponse(updated),
    },
  };
};

export const deleteContactMessage = async (contactMessageId: string): Promise<ServiceResult> => {
  if (!isValidObjectId(contactMessageId)) {
    return { statusCode: 400, data: { message: 'Invalid message id' } };
  }

  const deleted = await ContactMessage.findByIdAndDelete(contactMessageId).select('_id');
  if (!deleted) {
    return { statusCode: 404, data: { message: 'Message not found' } };
  }

  return {
    statusCode: 200,
    data: {
      message: 'Message deleted successfully',
      id: String(deleted._id),
    },
  };
};

export const createContactMessage = async (
  payload: CreateContactMessageInput,
  meta: ContactRequestMeta,
): Promise<ServiceResult> => {
  const normalizedEmail = payload.email.trim().toLowerCase();

  if (meta.idempotencyKey) {
    const existingByKey = await ContactMessage.findOne({ idempotencyKey: meta.idempotencyKey }).select('_id');
    if (existingByKey) {
      return {
        statusCode: 200,
        data: {
          message: 'Message already received',
          duplicate: true,
          id: String(existingByKey._id),
        },
      };
    }
  }

  const contentHash = buildContentHash(payload);
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);

  const existingRecent = await ContactMessage.findOne({
    email: normalizedEmail,
    contentHash,
    createdAt: { $gte: dedupCutoff },
  }).select('_id createdAt');

  if (existingRecent) {
    return {
      statusCode: 200,
      data: {
        message: 'Message already received recently',
        duplicate: true,
        id: String(existingRecent._id),
      },
    };
  }

  try {
    const created = await ContactMessage.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: normalizedEmail,
      subject: payload.subject,
      message: payload.message,
      contentHash,
      ...(meta.idempotencyKey ? { idempotencyKey: meta.idempotencyKey } : {}),
      ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    });

    return {
      statusCode: 201,
      data: {
        message: 'Message received successfully',
        duplicate: false,
        id: String(created._id),
      },
    };
  } catch (error) {
    if (isDuplicateIdempotencyError(error) && meta.idempotencyKey) {
      const existing = await ContactMessage.findOne({ idempotencyKey: meta.idempotencyKey }).select('_id');
      return {
        statusCode: 200,
        data: {
          message: 'Message already received',
          duplicate: true,
          id: existing ? String(existing._id) : null,
        },
      };
    }

    return {
      statusCode: 400,
      data: { message: (error as Error).message || 'Failed to submit contact message' },
    };
  }
};
