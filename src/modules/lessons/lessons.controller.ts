import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import type { LessonMediaFiles, LessonWritePayload } from './lessons.service.js';
import * as lessonsService from './lessons.service.js';

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

const parseBoolean = (value: unknown): boolean | undefined => {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	const normalized = value.trim().toLowerCase();
	if (normalized === 'true' || normalized === '1') {
		return true;
	}

	if (normalized === 'false' || normalized === '0') {
		return false;
	}

	return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value !== 'string' || !value.trim()) {
		return undefined;
	}

	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
};

const parseVideo = (body: Record<string, unknown>) => {
	const rawVideo = body.video;

	if (typeof rawVideo === 'object' && rawVideo !== null) {
		const videoObject = rawVideo as Record<string, unknown>;
		const youtubeId = typeof videoObject.youtubeId === 'string' ? videoObject.youtubeId : undefined;
		const duration = parseNumber(videoObject.duration);

		if (youtubeId) {
			return {
				youtubeId,
				...(duration !== undefined && { duration }),
			};
		}
	}

	if (typeof rawVideo === 'string' && rawVideo.trim()) {
		try {
			const parsed = JSON.parse(rawVideo) as Record<string, unknown>;
			const youtubeId = typeof parsed.youtubeId === 'string' ? parsed.youtubeId : undefined;
			const duration = parseNumber(parsed.duration);

			if (youtubeId) {
				return {
					youtubeId,
					...(duration !== undefined && { duration }),
				};
			}
		} catch {
			// no-op: fall back to youtubeId fields
		}
	}

	const youtubeId = typeof body.youtubeId === 'string' ? body.youtubeId : undefined;
	if (!youtubeId) {
		return undefined;
	}

	const duration = parseNumber(body.duration) ?? parseNumber(body.videoDuration);
	return {
		youtubeId,
		...(duration !== undefined && { duration }),
	};
};

const getPayloadFromBody = (body: Record<string, unknown>): LessonWritePayload => {
	const payload: LessonWritePayload = {};

	if (typeof body.course === 'string') {
		payload.course = body.course;
	}

	if (typeof body.title === 'string') {
		payload.title = body.title;
	}

	if (typeof body.description === 'string') {
		payload.description = body.description;
	}

	const order = parseNumber(body.order);
	if (order !== undefined) {
		payload.order = order;
	}

	const isPreview = parseBoolean(body.isPreview);
	if (isPreview !== undefined) {
		payload.isPreview = isPreview;
	}

	const isPublished = parseBoolean(body.isPublished);
	if (isPublished !== undefined) {
		payload.isPublished = isPublished;
	}

	const removeVideo = parseBoolean(body.removeVideo);
	if (removeVideo !== undefined) {
		payload.removeVideo = removeVideo;
	}

	const removePdf = parseBoolean(body.removePdf);
	if (removePdf !== undefined) {
		payload.removePdf = removePdf;
	}

	const removeThumbnail = parseBoolean(body.removeThumbnail);
	if (removeThumbnail !== undefined) {
		payload.removeThumbnail = removeThumbnail;
	}

	const video = parseVideo(body);
	if (video) {
		payload.video = video;
	}

	return payload;
};

const getFilesFromRequest = (req: AuthenticatedRequest): LessonMediaFiles => {
	const files = req.files as
		| {
				[fieldname: string]: Express.Multer.File[];
			}
		| undefined;

	const result: LessonMediaFiles = {};

	const pdf = files?.pdf?.[0];
	if (pdf) {
		result.pdf = pdf;
	}

	const thumbnail = files?.thumbnail?.[0];
	if (thumbnail) {
		result.thumbnail = thumbnail;
	}

	return result;
};

export const createLessonController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const payload = getPayloadFromBody(req.body as Record<string, unknown>);
	const files = getFilesFromRequest(req);

	const { statusCode, data } = await lessonsService.createLesson(payload, files, viewer);
	return res.status(statusCode).json(data);
};

export const getCourseLessonsController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const courseId = req.params.courseId;
	if (!courseId || typeof courseId !== 'string') {
		return res.status(400).json({ message: 'Course id is required' });
	}

	const { statusCode, data } = await lessonsService.getLessonsByCourse(courseId, viewer);
	return res.status(statusCode).json(data);
};

export const getLessonController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const lessonId = req.params.id;
	if (!lessonId || typeof lessonId !== 'string') {
		return res.status(400).json({ message: 'Lesson id is required' });
	}

	const { statusCode, data } = await lessonsService.getLessonById(lessonId, viewer);
	return res.status(statusCode).json(data);
};

export const updateLessonController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const lessonId = req.params.id;
	if (!lessonId || typeof lessonId !== 'string') {
		return res.status(400).json({ message: 'Lesson id is required' });
	}

	const payload = getPayloadFromBody(req.body as Record<string, unknown>);
	const files = getFilesFromRequest(req);

	const { statusCode, data } = await lessonsService.updateLesson(lessonId, payload, files, viewer);
	return res.status(statusCode).json(data);
};

export const deleteLessonController = async (req: AuthenticatedRequest, res: Response) => {
	const viewer = getViewerFromRequest(req);
	if (!viewer) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const lessonId = req.params.id;
	if (!lessonId || typeof lessonId !== 'string') {
		return res.status(400).json({ message: 'Lesson id is required' });
	}

	const { statusCode, data } = await lessonsService.deleteLesson(lessonId, viewer);
	return res.status(statusCode).json(data);
};
