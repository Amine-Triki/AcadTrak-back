import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import {
	createQuizController,
	deleteQuizController,
	getCourseQuizzesController,
	getStudentGradesController,
	healthController,
	submitQuizAttemptController,
	updateQuizController,
} from './quiz.controller.js';
import { createQuizSchema, updateQuizSchema } from './quiz-validation.js';

const router = express.Router();

router.get('/health', healthController);
// ✅ درجات الطالب وشهاداته
router.get('/my/grades', requireAuth, getStudentGradesController);
router.get('/course/:courseId', requireAuth, getCourseQuizzesController);
// ✅ فقط الأستاذ يُنشئ ويعدل ويحذف الاختبارات
router.post('/', requireAuth, authorize('teacher'), validate(createQuizSchema), createQuizController);
router.patch('/:quizId', requireAuth, authorize('teacher'), validate(updateQuizSchema), updateQuizController);
router.delete('/:quizId', requireAuth, authorize('teacher'), deleteQuizController);
// ✅ أي مستخدم مسجل دخوله يستطيع تقديم إجابة
router.post('/:quizId/submit', requireAuth, submitQuizAttemptController);

export default router;
