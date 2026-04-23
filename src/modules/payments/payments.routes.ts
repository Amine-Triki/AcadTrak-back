import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  healthPaymentController,
  initKonnectController,
  konnectWebhookController,
} from './payments.controller.js';

const router = express.Router();

router.get('/health', healthPaymentController);

// ── Konnect ───────────────────────────────────────────────────────────
router.post('/konnect/checkout/:courseId', requireAuth, initKonnectController);
router.post('/konnect/webhook', konnectWebhookController);
router.get('/konnect/webhook',  konnectWebhookController);

export default router;