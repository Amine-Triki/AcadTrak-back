import express from "express";
import validate from "../../middleware/validate.js";
import { optionalAuth, requireAuth } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { courseSchema, updateCourseSchema } from "./course-validation.js";
import {
	courseController,
	getMyCourseRatingController,
	healthController,
	getAllController,
	getOneController,
	rateCourseController,
	updateCourseController,
	deleteCourseController,
} from "./courses.controller.js";

const router = express.Router();

router.get("/health", healthController);

// ✅ فقط الأستاذ يُنشئ ويُعدّل — Admin لا يملك هذه الصلاحية
router.post("/", requireAuth, authorize("teacher"), validate(courseSchema), courseController);

router.get("/", optionalAuth, getAllController);

router.get('/:id/my-rating', requireAuth, authorize('student', 'teacher'), getMyCourseRatingController);

router.post('/:id/rate', requireAuth, authorize('student', 'teacher'), rateCourseController);

router.get("/:id", optionalAuth, getOneController);

// ✅ فقط الأستاذ يُعدّل دورته
router.patch("/:id", requireAuth, authorize("teacher"), validate(updateCourseSchema), updateCourseController);

// ✅ Admin يستطيع الحذف للإشراف — لكن الـ service تتحقق من الملكية للأستاذ
router.delete("/:id", requireAuth, authorize("teacher", "admin"), deleteCourseController);


export default router;