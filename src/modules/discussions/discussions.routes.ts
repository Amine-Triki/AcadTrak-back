import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  answerDiscussionController,
  createDiscussionController,
  healthDiscussionController,
  listCourseDiscussionsController,
  softDeleteDiscussionController,
  updateDiscussionController,
} from './discussions.controller.js';

const router = express.Router();

router.get('/health', healthDiscussionController);
router.get('/course/:courseId', requireAuth, listCourseDiscussionsController);
router.post('/', requireAuth, createDiscussionController);
router.patch('/:id', requireAuth, updateDiscussionController);
router.patch('/:id/answer', requireAuth, answerDiscussionController);
router.delete('/:id', requireAuth, softDeleteDiscussionController);

export default router;
