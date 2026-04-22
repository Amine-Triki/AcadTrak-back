import express, {type Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import usersRouter from "./modules/users/users.routes.js";
import coursesRouter from "./modules/courses/courses.routes.js";
import enrollmentsRouter from "./modules/enrollments/enrollments.routes.js";
import lessonsRouter from "./modules/lessons/lessons.routes.js";
import quizRouter from "./modules/quiz/quiz.routes.js";
import discussionsRouter from "./modules/discussions/discussions.routes.js";
import contactRouter from "./modules/contact/contact.routes.js";
import paymentRouter from "./modules/payments/payments.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app: Application = express();

// 1. Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
}));

app.use("/api/users",       usersRouter);
app.use("/api/courses",     coursesRouter);
app.use("/api/enrollments", enrollmentsRouter);
app.use("/api/lessons",     lessonsRouter);
app.use("/api/quiz",        quizRouter);
app.use("/api/discussions", discussionsRouter);
app.use("/api/contact",     contactRouter);
app.use("/api/payments",    paymentRouter);

app.use(errorHandler);

export default app; 