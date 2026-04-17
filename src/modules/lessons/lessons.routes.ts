import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import { upload } from '../../middleware/upload.js';
import {
	createLessonController,
	deleteLessonController,
	getCourseLessonsController,
	getLessonController,
	updateLessonController,
} from './lessons.controller.js';

const router = express.Router();

const uploadLessonAssets = upload.fields([
	{ name: 'pdf', maxCount: 1 },
	{ name: 'thumbnail', maxCount: 1 },
]);

router.post('/', requireAuth, authorize('teacher', 'admin'), uploadLessonAssets, createLessonController);

router.get('/course/:courseId', requireAuth, getCourseLessonsController);

router.get('/:id', requireAuth, getLessonController);

router.patch('/:id', requireAuth, authorize('teacher', 'admin'), uploadLessonAssets, updateLessonController);

router.delete('/:id', requireAuth, authorize('teacher', 'admin'), deleteLessonController);

export default router;
