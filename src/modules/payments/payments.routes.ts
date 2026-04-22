import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  flouciWebhookController,
  healthPaymentController,
  initFlouciController,
  initKonnectController,
  konnectWebhookController,
  verifyFlouciController,
} from './payments.controller.js';

const router = express.Router();

router.get('/health', healthPaymentController);

// ── Flouci ────────────────────────────────────────────────────────────
// تهيئة دفع جديد
router.post('/flouci/checkout/:courseId', requireAuth, initFlouciController);
// Webhook — يُستدعى من Flouci بعد اكتمال الدفع (بدون auth)
router.post('/flouci/webhook',  flouciWebhookController);
router.get('/flouci/webhook',   flouciWebhookController); // Flouci قد يرسل GET أحياناً
// تحقق يدوي من Frontend بعد redirect
router.get('/flouci/verify/:paymentId', requireAuth, verifyFlouciController);

// ── Konnect ───────────────────────────────────────────────────────────
router.post('/konnect/checkout/:courseId', requireAuth, initKonnectController);
router.post('/konnect/webhook',  konnectWebhookController);
router.get('/konnect/webhook',   konnectWebhookController);

export default router;
