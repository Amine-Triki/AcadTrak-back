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
	logoutController,
	listUsersController,
	softDeleteController,
	restoreController,
} from "./users.controller.js";

const router = express.Router();

router.post("/register", validate(registerSchema), registerController);

router.post("/login", validate(loginSchema), loginController);

router.post("/upgrade-to-teacher", requireAuth, upgradeToTeacherController);

router.get("/me", requireAuth, meController);

router.get("/", requireAuth, authorize("admin"), listUsersController);

router.patch("/:id/soft-delete", requireAuth, authorize("admin"), softDeleteController);

router.patch("/:id/restore", requireAuth, authorize("admin"), restoreController);

router.post("/logout", logoutController);



export default router;
