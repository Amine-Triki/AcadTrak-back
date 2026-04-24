import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';
import {
	courseEnrollmentsController,
	enrollInCourseController,
	myEnrollmentsController,
	teacherStudentsController,
} from './enrollments.controller.js';

const router = express.Router();

// Fix #6: Add explicit authorize middleware - students, teachers, and admins can enroll
router.post('/course/:courseId/enroll', requireAuth, authorize('student', 'teacher', 'admin'), enrollInCourseController);

// Only teachers/admins can view course enrollments (ownership checked in service)
router.get('/course/:courseId', requireAuth, authorize('teacher', 'admin'), courseEnrollmentsController);

// Any authenticated user can view their own enrollments
router.get('/my', requireAuth, myEnrollmentsController);

// Only teachers/ can view their students
router.get('/teacher/students', requireAuth, authorize('teacher'), teacherStudentsController);

export default router;
