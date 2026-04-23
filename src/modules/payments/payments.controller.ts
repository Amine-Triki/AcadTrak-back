import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { initKonnectPayment, handleKonnectWebhook } from './konnect.service.js';

const getViewer = (req: AuthenticatedRequest) => {
  const u = req.authUser;
  if (!u) return null;
  return { userId: u.id, role: u.role };
};

export const initKonnectController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewer(req);
  if (!viewer) return res.status(401).json({ message: 'Unauthorized' });
  const courseId   = req.params.courseId;
  if (!courseId || typeof courseId !== 'string') {
    return res.status(400).json({ message: 'Course id is required' });
  }
  const couponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode : undefined;
  const { statusCode, data } = await initKonnectPayment(courseId, viewer, couponCode);
  return res.status(statusCode).json(data);
};

export const konnectWebhookController = async (req: Request, res: Response) => {
  const paymentRef = req.query.payment_ref as string | undefined
    ?? (req.body as Record<string, string>)?.payment_ref;
  const { statusCode, data } = await handleKonnectWebhook(paymentRef ?? '');
  return res.status(statusCode).json(data);
};

export const healthPaymentController = (_req: Request, res: Response) => {
  return res.status(200).json({ message: 'Payments module is running' });
};