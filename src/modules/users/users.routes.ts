import express from "express";
import validate from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { authorize } from "../../middleware/authorize.js";
import { registerSchema, loginSchema } from "./user-validation.js";
import {
	registerController,
	loginController,
	upgradeToTeacherController,
	meController,
	publicProfileController,
	updateMyProfileController,
	logoutController,
	listUsersController,
	dashboardStatsController,
	softDeleteController,
	restoreController,
} from "./users.controller.js";

const router = express.Router();

router.post("/register", validate(registerSchema), registerController);

router.post("/login", validate(loginSchema), loginController);

router.post("/upgrade-to-teacher", requireAuth, upgradeToTeacherController);

router.get("/me", requireAuth, meController);
router.patch("/me/profile", requireAuth, updateMyProfileController);
router.get("/public/:id", publicProfileController);

router.get("/dashboard-stats", requireAuth, dashboardStatsController);

router.get("/", requireAuth, authorize("admin"), listUsersController);

router.patch("/:id/soft-delete", requireAuth, authorize("admin"), softDeleteController);

router.patch("/:id/restore", requireAuth, authorize("admin"), restoreController);

router.post("/logout", logoutController);



export default router;
