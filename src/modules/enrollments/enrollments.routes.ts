import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
	courseEnrollmentsController,
	enrollInCourseController,
	myEnrollmentsController,
} from './enrollments.controller.js';

const router = express.Router();

router.post('/course/:courseId/enroll', requireAuth, enrollInCourseController);
router.get('/course/:courseId', requireAuth, courseEnrollmentsController);
router.get('/my', requireAuth, myEnrollmentsController);

export default router;
