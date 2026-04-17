import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.js";
import type { UserRole } from "../utils/jwt.js";

export const authorize = (...roles: UserRole[]) => {
	return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		const userRole = req.authUser?.role;
		if (!userRole || !roles.includes(userRole)) {
			return res.status(403).json({ message: "Forbidden" });
		}

		next();
	};
};
