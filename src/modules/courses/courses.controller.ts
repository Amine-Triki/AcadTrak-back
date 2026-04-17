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
