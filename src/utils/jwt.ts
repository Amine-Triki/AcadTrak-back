import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export type UserRole = "student" | "teacher" | "admin";

export interface AuthTokenPayload {
	id: string;
	email: string;
	role: UserRole;
}

export const signAuthToken = (payload: AuthTokenPayload) => {
	const expiresIn = (env.JWT_EXPIRES_IN || "7d") as NonNullable<
		SignOptions["expiresIn"]
	>;

	return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
};

export const verifyAuthToken = (token: string): AuthTokenPayload | null => {
	try {
		const decoded = jwt.verify(token, env.JWT_SECRET);
		if (!decoded || typeof decoded === "string") {
			return null;
		}

		const payload = decoded as Partial<AuthTokenPayload>;
		const role = payload.role;
		const validRole =
			role === "student" ||
			role === "teacher" ||
			role === "admin";

		if (!payload.id || !payload.email || !validRole) {
			return null;
		}

		return {
			id: payload.id,
			email: payload.email,
			role,
		};
	} catch {
		return null;
	}
};
