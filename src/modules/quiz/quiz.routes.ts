import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import {
	createQuizController,
	deleteQuizController,
	getCourseQuizzesController,
	healthController,
	submitQuizAttemptController,
	updateQuizController,
} from './quiz.controller.js';
import { createQuizSchema, updateQuizSchema } from './quiz-validation.js';

const router = express.Router();

router.get('/health', healthController);
router.get('/course/:courseId', requireAuth, getCourseQuizzesController);
router.post('/', requireAuth, authorize('teacher', 'admin'), validate(createQuizSchema), createQuizController);
router.patch('/:quizId', requireAuth, authorize('teacher', 'admin'), validate(updateQuizSchema), updateQuizController);
router.delete('/:quizId', requireAuth, authorize('teacher', 'admin'), deleteQuizController);
router.post('/:quizId/submit', requireAuth, submitQuizAttemptController);

export default router;
