import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
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

// أي مستخدم مسجل يمكنه رؤية الـ discussions إذا كان مسجلاً في الدورة
router.get('/course/:courseId', requireAuth, listCourseDiscussionsController);

// الطالب أو الأستاذ المسجل يمكنه طرح سؤال (الـ service تتحقق من الـ enrollment)
router.post('/', requireAuth, authorize('student', 'teacher'), createDiscussionController);

// صاحب السؤال فقط يعدله
router.patch('/:id', requireAuth, authorize('student', 'teacher'), updateDiscussionController);

// ✅ فقط الأستاذ صاحب الدورة يجيب
router.patch('/:id/answer', requireAuth, authorize('teacher'), answerDiscussionController);

// صاحب السؤال يحذفه
router.delete('/:id', requireAuth, authorize('student', 'teacher'), softDeleteDiscussionController);

export default router;
