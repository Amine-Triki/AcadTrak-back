import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { initFlouciPayment, handleFlouciWebhook, verifyFlouciPayment } from './flouci.service.js';
import { initKonnectPayment, handleKonnectWebhook } from './konnect.service.js';

const getViewer = (req: AuthenticatedRequest) => {
  const u = req.authUser;
  if (!u) return null;
  return { userId: u.id, role: u.role };
};

// ── Flouci ────────────────────────────────────────────────
export const initFlouciController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewer(req);
  if (!viewer) return res.status(401).json({ message: 'Unauthorized' });

  const courseId    = req.params.courseId;
  const couponCode  = typeof req.body?.couponCode === 'string' ? req.body.couponCode : undefined;

  const { statusCode, data } = await initFlouciPayment(courseId, viewer, couponCode);
  return res.status(statusCode).json(data);
};

export const flouciWebhookController = async (req: Request, res: Response) => {
  // Flouci يرسل payment_id كـ query param
  const paymentId = req.query.payment_id as string | undefined
    ?? (req.body as Record<string, string>)?.payment_id;
  const { statusCode, data } = await handleFlouciWebhook(paymentId ?? '');
  return res.status(statusCode).json(data);
};

export const verifyFlouciController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewer(req);
  if (!viewer) return res.status(401).json({ message: 'Unauthorized' });

  const paymentId = req.params.paymentId;
  const { statusCode, data } = await verifyFlouciPayment(paymentId, viewer);
  return res.status(statusCode).json(data);
};

// ── Konnect ───────────────────────────────────────────────
export const initKonnectController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewer(req);
  if (!viewer) return res.status(401).json({ message: 'Unauthorized' });

  const courseId   = req.params.courseId;
  const couponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode : undefined;

  const { statusCode, data } = await initKonnectPayment(courseId, viewer, couponCode);
  return res.status(statusCode).json(data);
};

export const konnectWebhookController = async (req: Request, res: Response) => {
  // Konnect يرسل payment_ref كـ query param
  const paymentRef = req.query.payment_ref as string | undefined
    ?? (req.body as Record<string, string>)?.payment_ref;
  const { statusCode, data } = await handleKonnectWebhook(paymentRef ?? '');
  return res.status(statusCode).json(data);
};

export const healthPaymentController = (_req: Request, res: Response) => {
  return res.status(200).json({ message: 'Payments module is running' });
};
