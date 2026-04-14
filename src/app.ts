import express, {type Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

/* import { env } from "./config/env.js";
import { router } from "./modules/index.routes.js"; // تجمع كل المسارات هنا */
/* import { errorHandler } from "./middleware/errorHandler.js"; */

const app: Application = express();

// 1. Middlewares
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

// 2. Routes (هنا نستخدم الـ router!)
/* app.use("/api", router);

// 3. Centralized Error Handler
app.use(errorHandler); */

export default app; // نصدر الـ app لاستخدامه في الاختبارات وفي ملف التشغيل