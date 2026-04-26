import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import {
  getCourseProgressController,
  markLessonCompleteController,
} from './progress.controller.js';

const router = express.Router();

// ✅ Student وTeacher (كطالب) يتتبعان تقدمهما
router.get(
  '/course/:courseId',
  requireAuth,
  authorize('student', 'teacher'),
  getCourseProgressController,
);

router.post(
  '/course/:courseId/lesson/:lessonId/complete',
  requireAuth,
  authorize('student', 'teacher'),
  markLessonCompleteController,
);

export default router;
