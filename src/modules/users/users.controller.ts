import type { Request, Response } from "express";
import * as usersService from "./users.service.js";

export const registerController = async (req: Request, res: Response) => {
  const { statusCode, data } = await usersService.register(req.body);
  res.status(statusCode).json(data);
};

export const loginController = async (req: Request, res: Response) => {
  const { statusCode, data } = await usersService.login(req.body);
  res.status(statusCode).json(data);
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