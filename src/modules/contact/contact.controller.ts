import type { Request, Response } from 'express';
import {
  createContactMessageSchema,
  listContactMessagesQuerySchema,
  updateContactMessageArchiveSchema,
  updateContactMessageReadSchema,
} from './contact-validation.js';
import * as contactService from './contact.service.js';

const extractIdempotencyKey = (req: Request) => {
  const rawKey = req.header('x-idempotency-key');
  if (!rawKey || typeof rawKey !== 'string') {
    return undefined;
  }

  const trimmed = rawKey.trim();
  if (!trimmed || trimmed.length > 128) {
    return undefined;
  }

  return trimmed;
};

const extractClientIp = (req: Request) => {
  const forwardedFor = req.header('x-forwarded-for');
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim();
  }

  return req.ip;
};

export const createContactMessageController = async (req: Request, res: Response) => {
  const payloadResult = createContactMessageSchema.safeParse(req.body);
  if (!payloadResult.success) {
    return res.status(400).json({
      message: payloadResult.error.issues[0]?.message || 'Invalid payload',
    });
  }

  const idempotencyKey = extractIdempotencyKey(req);
  const ipAddress = extractClientIp(req);
  const userAgent = req.header('user-agent');

  const requestMeta = {
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };

  const { statusCode, data } = await contactService.createContactMessage(payloadResult.data, requestMeta);

  return res.status(statusCode).json(data);
};

export const listContactMessagesController = async (req: Request, res: Response) => {
  const queryResult = listContactMessagesQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    return res.status(400).json({
      message: queryResult.error.issues[0]?.message || 'Invalid query parameters',
    });
  }

  const { statusCode, data } = await contactService.listContactMessages(queryResult.data);
  return res.status(statusCode).json(data);
};

export const updateContactMessageReadController = async (req: Request, res: Response) => {
  const contactMessageId = req.params.id;
  if (!contactMessageId || typeof contactMessageId !== 'string') {
    return res.status(400).json({ message: 'Message id is required' });
  }

  const payloadResult = updateContactMessageReadSchema.safeParse(req.body);
  if (!payloadResult.success) {
    return res.status(400).json({
      message: payloadResult.error.issues[0]?.message || 'Invalid payload',
    });
  }

  const { statusCode, data } = await contactService.updateContactMessageReadStatus(contactMessageId, payloadResult.data);
  return res.status(statusCode).json(data);
};

export const updateContactMessageArchiveController = async (req: Request, res: Response) => {
  const contactMessageId = req.params.id;
  if (!contactMessageId || typeof contactMessageId !== 'string') {
    return res.status(400).json({ message: 'Message id is required' });
  }

  const payloadResult = updateContactMessageArchiveSchema.safeParse(req.body);
  if (!payloadResult.success) {
    return res.status(400).json({
      message: payloadResult.error.issues[0]?.message || 'Invalid payload',
    });
  }

  const { statusCode, data } = await contactService.updateContactMessageArchiveStatus(contactMessageId, payloadResult.data);
  return res.status(statusCode).json(data);
};

export const deleteContactMessageController = async (req: Request, res: Response) => {
  const contactMessageId = req.params.id;
  if (!contactMessageId || typeof contactMessageId !== 'string') {
    return res.status(400).json({ message: 'Message id is required' });
  }

  const { statusCode, data } = await contactService.deleteContactMessage(contactMessageId);
  return res.status(statusCode).json(data);
};

export const healthContactController = (_req: Request, res: Response) => {
  return res.status(200).json({ message: 'Contact module is running' });
};
