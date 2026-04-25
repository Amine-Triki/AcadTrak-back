import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import {
  healthPaymentController,
  initKonnectController,
  konnectWebhookController,
} from './payments.controller.js';

const router = express.Router();

router.get('/health', healthPaymentController);

// ── Konnect ───────────────────────────────────────────────────────────
// ✅ فقط Student وTeacher يدفعان — Admin مراقب لا يشتري دورات
router.post('/konnect/checkout/:courseId', requireAuth, authorize('student', 'teacher'), initKonnectController);
router.post('/konnect/webhook', konnectWebhookController);
router.get('/konnect/webhook',  konnectWebhookController);

export default router;