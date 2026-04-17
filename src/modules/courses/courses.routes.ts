import express from "express";
import validate from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { courseSchema, updateCourseSchema } from "./course-validation.js";
import {
	courseController,
	healthController,
	getAllController,
	getOneController,
	updateCourseController,
	deleteCourseController,
} from "./courses.controller.js";

const router = express.Router();

router.get("/health", healthController);

router.post("/", requireAuth, authorize("teacher", "admin"), validate(courseSchema), courseController);

router.get("/", requireAuth, getAllController);

router.get("/:id", requireAuth, getOneController);

router.patch("/:id", requireAuth, authorize("teacher", "admin"), validate(updateCourseSchema), updateCourseController);

router.delete("/:id", requireAuth, authorize("teacher", "admin"), deleteCourseController);


export default router;