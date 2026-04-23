import type { Request, Response } from "express";
import * as usersService from "./users.service.js";
import type { AuthenticatedRequest } from "../../middleware/auth.js";
import { env } from "../../config/env.js";

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const registerController = async (req: Request, res: Response) => {
  const { statusCode, data } = await usersService.register(req.body);
  if (statusCode >= 400 || !data || typeof data !== "object" || !("token" in data)) {
    return res.status(statusCode).json(data);
  }

  const token = data.token as string;
  const user = data.user;

  res.cookie(env.AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
  return res.status(statusCode).json({
    message: "Registered successfully",
    user,
  });
};

export const loginController = async (req: Request, res: Response) => {
  const { statusCode, data } = await usersService.login(req.body);
  if (statusCode >= 400 || !data || typeof data !== "object" || !("token" in data)) {
    return res.status(statusCode).json(data);
  }

  const token = data.token as string;
  const user = data.user;

  res.cookie(env.AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
  return res.status(statusCode).json({
    message: "Logged in successfully",
    user,
  });
};

export const upgradeToTeacherController = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { statusCode, data } = await usersService.upgradeToTeacher(userId);
  if (statusCode >= 400 || !data || typeof data !== "object" || !("token" in data)) {
    return res.status(statusCode).json(data);
  }

  const token = data.token as string;
  const user = data.user;

  res.cookie(env.AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
  return res.status(statusCode).json({
    message: "Account upgraded to teacher successfully",
    user,
  });
};

export const meController = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { statusCode, data } = await usersService.getCurrentUser(userId);
  return res.status(statusCode).json(data);
};

export const listUsersController = async (req: Request, res: Response) => {
  const includeDeleted = String(req.query.includeDeleted || "false") === "true";
  const { statusCode, data } = await usersService.listUsers(includeDeleted);
  return res.status(statusCode).json(data);
};

export const dashboardStatsController = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser?.id;
  const role = req.authUser?.role;

  if (!userId || !role) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { statusCode, data } = await usersService.getDashboardStats({ userId, role });
  return res.status(statusCode).json(data);
};

export const logoutController = (_req: Request, res: Response) => {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return res.status(200).json({ message: "Logged out successfully" });
};

export const softDeleteController = async (req: Request, res: Response) => {
  const userId = req.params.id;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ data: "User id is required" });
  }

  const { statusCode, data } = await usersService.softDeleteUser(userId);
  res.status(statusCode).json(data);
};

export const restoreController = async (req: Request, res: Response) => {
  const userId = req.params.id;
  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ data: "User id is required" });
  }

  const { statusCode, data } = await usersService.restoreUser(userId);
  res.status(statusCode).json(data);
};