import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

const validate = (schema: ZodTypeAny) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const result = schema.safeParse(req.body);

		if (!result.success) {
			return res.status(400).json({
				data: result.error.issues[0]?.message || "Validation error",
			});
		}

		req.body = result.data;
		next();
	};
};

export default validate;
