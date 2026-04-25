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

// ✅ Student وTeacher فقط — Admin مراقب لا يسجل في دورات
router.post('/course/:courseId/enroll', requireAuth, authorize('student', 'teacher'), enrollInCourseController);

// ✅ فقط الأستاذ صاحب الدورة يرى enrollments (الـ service تتحقق من الملكية)
router.get('/course/:courseId', requireAuth, authorize('teacher'), courseEnrollmentsController);

// ✅ أي مستخدم مسجل يرى دوراته
router.get('/my', requireAuth, myEnrollmentsController);

// ✅ فقط الأستاذ يرى طلابه
router.get('/teacher/students', requireAuth, authorize('teacher'), teacherStudentsController);

export default router;
