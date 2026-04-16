import express, {type Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import usersRouter from "./modules/users/users.routes.js";

/* import { env } from "./config/env.js";
import { router } from "./modules/index.routes.js"; // تجمع كل المسارات هنا */
/* import { errorHandler } from "./middleware/errorHandler.js"; */

const app: Application = express();

// 1. Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use("/api/users", usersRouter);

export default app; // نصدر الـ app لاستخدامه في الاختبارات وفي ملف التشغيل