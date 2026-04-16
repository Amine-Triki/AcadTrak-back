import express from "express";
import validate from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { registerSchema, loginSchema } from "./user-validation.js";
import {
	registerController,
	loginController,
	meController,
	logoutController,
} from "./users.controller.js";

const router = express.Router();

router.post("/register", validate(registerSchema), registerController);

router.post("/login", validate(loginSchema), loginController);

router.get("/me", requireAuth, meController);

router.post("/logout", logoutController);



export default router;
