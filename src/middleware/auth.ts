import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import type { AuthTokenPayload } from "../utils/jwt.js";
import { verifyAuthToken } from "../utils/jwt.js";

export interface AuthenticatedRequest extends Request {
	authUser?: AuthTokenPayload;
}

export const requireAuth = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
) => {
	const token = req.cookies?.[env.AUTH_COOKIE_NAME] as string | undefined;

	if (!token) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	const payload = verifyAuthToken(token);
	if (!payload) {
		return res.status(401).json({ message: "Unauthorized" });
	}

	req.authUser = payload;
	next();
};

export const optionalAuth = (
	req: AuthenticatedRequest,
	_res: Response,
	next: NextFunction,
) => {
	const token = req.cookies?.[env.AUTH_COOKIE_NAME] as string | undefined;
	if (!token) {
		next();
		return;
	}

	const payload = verifyAuthToken(token);
	if (payload) {
		req.authUser = payload;
	}

	next();
};
