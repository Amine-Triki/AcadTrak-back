import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import {
  createContactMessageController,
  deleteContactMessageController,
  healthContactController,
  listContactMessagesController,
  updateContactMessageArchiveController,
  updateContactMessageReadController,
} from './contact.controller.js';

const router = express.Router();

router.get('/health', healthContactController);
router.get('/', requireAuth, authorize('admin'), listContactMessagesController);
router.patch('/:id/read', requireAuth, authorize('admin'), updateContactMessageReadController);
router.patch('/:id/archive', requireAuth, authorize('admin'), updateContactMessageArchiveController);
router.delete('/:id', requireAuth, authorize('admin'), deleteContactMessageController);
router.post('/', createContactMessageController);

export default router;
