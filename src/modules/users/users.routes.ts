import express from "express";
import validate from "../../middleware/validate.js";
import { registerSchema, loginSchema } from "./user-validation.js";
import { registerController, loginController } from "./users.controller.js";

const router = express.Router();

router.post("/register", validate(registerSchema), registerController);

router.post("/login", validate(loginSchema), loginController);



export default router;
