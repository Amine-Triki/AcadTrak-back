import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { enrollInCourseController, myEnrollmentsController } from './enrollments.controller.js';

const router = express.Router();

router.post('/course/:courseId/enroll', requireAuth, enrollInCourseController);
router.get('/my', requireAuth, myEnrollmentsController);

export default router;
