import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import * as coursesService from './courses.service.js';

const getViewerFromRequest = (req: AuthenticatedRequest) => {
	const authUser = req.authUser;
	if (!authUser) {
		return null;
	}

	return {
		userId: authUser.id,
		role: authUser.role,
	};
};

export const courseController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const { statusCode, data } = await coursesService.createCourse(req.body, viewer);
	return res.status(statusCode).json(data);
};

export const getAllController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req) || undefined;
	const { statusCode, data } = await coursesService.getAllCourses(viewer);
	return res.status(statusCode).json(data);
};

export const getOneController = async (req: AuthenticatedRequest, res: Response) => {
	const courseId = req.params.id;
	if (!courseId || typeof courseId !== 'string') {
		return res.status(400).json({ message: 'Course id is required' });
	}

	const couponCode = typeof req.query.couponCode === 'string' ? req.query.couponCode : undefined;
	const viewer = getViewerFromRequest(req) || undefined;
	const { statusCode, data } = await coursesService.getCourseById(courseId, viewer, couponCode);
	return res.status(statusCode).json(data);
};

export const updateCourseController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const courseId = req.params.id;
	if (!courseId || typeof courseId !== 'string') {
		return res.status(400).json({ message: 'Course id is required' });
	}

	const { statusCode, data } = await coursesService.updateCourse(courseId, req.body, viewer);
	return res.status(statusCode).json(data);
};

export const deleteCourseController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const courseId = req.params.id;
	if (!courseId || typeof courseId !== 'string') {
		return res.status(400).json({ message: 'Course id is required' });
	}

	const { statusCode, data } = await coursesService.deleteOrHideCourse(courseId, viewer);
	return res.status(statusCode).json(data);
};

export const healthController = (_req: Request, res: Response) => {
	return res.status(200).json({ message: 'Courses module is running' });
};

export const getMyCourseRatingController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const courseId = req.params.id;
	if (!courseId || typeof courseId !== 'string') {
		return res.status(400).json({ message: 'Course id is required' });
	}

	const { statusCode, data } = await coursesService.getMyCourseRating(courseId, viewer);
	return res.status(statusCode).json(data);
};

export const rateCourseController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const courseId = req.params.id;
	if (!courseId || typeof courseId !== 'string') {
		return res.status(400).json({ message: 'Course id is required' });
	}

	const rawRating = req.body?.rating;
	const rawComment = req.body?.comment;

	if (!Number.isInteger(rawRating) || rawRating < 1 || rawRating > 5) {
		return res.status(400).json({ message: 'rating must be an integer between 1 and 5' });
	}

	if (rawComment !== undefined && typeof rawComment !== 'string') {
		return res.status(400).json({ message: 'comment must be a string' });
	}

	if (typeof rawComment === 'string' && rawComment.trim().length > 500) {
		return res.status(400).json({ message: 'comment is too long (max 500 characters)' });
	}

	const { statusCode, data } = await coursesService.rateCourse(
		courseId,
		{ rating: rawRating, comment: rawComment },
		viewer,
	);

	return res.status(statusCode).json(data);
};
