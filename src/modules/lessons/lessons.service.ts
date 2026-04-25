import { Types } from 'mongoose';
import { Course } from '../courses/course.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.js';
import { isValidObjectId } from '../../utils/mongo.js';
import { Lesson } from './lesson.model.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';

interface LessonVideoInput {
	youtubeId: string;
	duration?: number;
}

export interface LessonWritePayload {
	course?: string;
	title?: string;
	description?: string;
	order?: number;
	isPreview?: boolean;
	isPublished?: boolean;
	video?: LessonVideoInput;
	removeVideo?: boolean;
	removePdf?: boolean;
	removeThumbnail?: boolean;
}

export interface LessonMediaFiles {
	pdf?: Express.Multer.File;
	thumbnail?: Express.Multer.File;
}

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

const extractYouTubeId = (value: string) => {
	const trimmed = value.trim();

	if (YOUTUBE_ID_REGEX.test(trimmed)) {
		return trimmed;
	}

	const match = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
	return match?.[1] || trimmed;
};

const canManageCourse = (courseInstructorId: string, viewer: ViewerContext) => {
	// ✅ فقط الأستاذ صاحب الدورة — Admin لا يُدير الدروس
	return viewer.role === 'teacher' && courseInstructorId === viewer.userId;
};

const normalizeTitle = (title: string | undefined) => title?.trim();

const normalizeDescription = (description: string | undefined) => {
	if (description === undefined) {
		return undefined;
	}

	const value = description.trim();
	return value ? value : undefined;
};

const validateVideo = (video: LessonVideoInput | undefined) => {
	if (!video) {
		return { valid: true as const };
	}

	const youtubeId = extractYouTubeId(video.youtubeId);
	if (!YOUTUBE_ID_REGEX.test(youtubeId)) {
		return {
			valid: false as const,
			message: 'Invalid YouTube video ID',
		};
	}

	if (video.duration !== undefined && video.duration < 0) {
		return {
			valid: false as const,
			message: 'Video duration must be greater than or equal to 0',
		};
	}

	return {
		valid: true as const,
		value: {
			youtubeId,
			...(video.duration !== undefined && { duration: video.duration }),
		},
	};
};

const cleanupUploadedAssets = async (publicIds: Array<{ publicId: string; resourceType: 'image' | 'raw' }>) => {
	await Promise.all(
		publicIds.map(({ publicId, resourceType }) =>
			deleteFromCloudinary(publicId, resourceType).catch(() => null),
		),
	);
};

const validateUploadedFileTypes = (files: LessonMediaFiles): ServiceResult | null => {
	if (files.pdf && files.pdf.mimetype !== 'application/pdf') {
		return {
			statusCode: 400,
			data: { message: 'pdf field accepts PDF files only' },
		};
	}

	if (files.thumbnail && !files.thumbnail.mimetype.startsWith('image/')) {
		return {
			statusCode: 400,
			data: { message: 'thumbnail field accepts image files only' },
		};
	}

	return null;
};

const getCourseWithPermissionCheck = async (
	courseId: string,
	viewer: ViewerContext,
) => {
	if (!isValidObjectId(courseId)) {
		return {
			error: { statusCode: 400, data: { message: 'Invalid course id' } },
		};
	}

	const course = await Course.findById(courseId).select('_id instructor');
	if (!course) {
		return {
			error: { statusCode: 404, data: { message: 'Course not found' } },
		};
	}

	if (!canManageCourse(String(course.instructor), viewer)) {
		return {
			error: { statusCode: 403, data: { message: 'You are not allowed to manage lessons for this course' } },
		};
	}

	return { course };
};

export const createLesson = async (
	payload: LessonWritePayload,
	files: LessonMediaFiles,
	viewer: ViewerContext,
): Promise<ServiceResult> => {
	// ✅ فقط الأستاذ ينشئ الدروس
	if (viewer.role !== 'teacher') {
		return { statusCode: 403, data: { message: 'Only teachers can create lessons' } };
	}

	if (!payload.course) {
		return { statusCode: 400, data: { message: 'Course is required' } };
	}

	const permissionResult = await getCourseWithPermissionCheck(payload.course, viewer);
	if (permissionResult.error) {
		return permissionResult.error;
	}

	const title = normalizeTitle(payload.title);
	if (!title || title.length < 2) {
		return { statusCode: 400, data: { message: 'Title must be at least 2 characters' } };
	}

	const videoValidation = validateVideo(payload.video);
	if (!videoValidation.valid) {
		return { statusCode: 400, data: { message: videoValidation.message } };
	}

	if (payload.order !== undefined && payload.order < 0) {
		return { statusCode: 400, data: { message: 'Order must be greater than or equal to 0' } };
	}

	const filesValidation = validateUploadedFileTypes(files);
	if (filesValidation) {
		return filesValidation;
	}

	const uploadedAssets: Array<{ publicId: string; resourceType: 'image' | 'raw' }> = [];

	try {
		const [uploadedPdf, uploadedThumbnail] = await Promise.all([
			files.pdf
				? uploadToCloudinary(files.pdf.buffer, 'acadtrak/lessons/pdfs', 'raw')
				: Promise.resolve(undefined),
			files.thumbnail
				? uploadToCloudinary(files.thumbnail.buffer, 'acadtrak/lessons/thumbnails', 'image')
				: Promise.resolve(undefined),
		]);

		if (uploadedPdf) {
			uploadedAssets.push({ publicId: uploadedPdf.publicId, resourceType: 'raw' });
		}

		if (uploadedThumbnail) {
			uploadedAssets.push({ publicId: uploadedThumbnail.publicId, resourceType: 'image' });
		}

		const hasVideo = Boolean(videoValidation.value?.youtubeId);
		const hasPdf = Boolean(uploadedPdf?.url);

		if (!hasVideo && !hasPdf) {
			await cleanupUploadedAssets(uploadedAssets);
			return { statusCode: 400, data: { message: 'Lesson must have at least a YouTube video or a PDF' } };
		}

		const description = normalizeDescription(payload.description);

		const createPayload: {
			course: Types.ObjectId;
			title: string;
			description?: string;
			order: number;
			isPreview: boolean;
			isPublished: boolean;
			video?: LessonVideoInput;
			pdf?: {
				url: string;
				publicId: string;
				bytes: number;
			};
			thumbnail?: {
				url: string;
				publicId: string;
				bytes: number;
			};
		} = {
			course: new Types.ObjectId(payload.course),
			title,
			order: payload.order ?? 0,
			isPreview: payload.isPreview ?? false,
			isPublished: payload.isPublished ?? false,
		};

		if (description) {
			createPayload.description = description;
		}

		if (videoValidation.value) {
			createPayload.video = videoValidation.value;
		}

		if (uploadedPdf) {
			createPayload.pdf = {
				url: uploadedPdf.url,
				publicId: uploadedPdf.publicId,
				bytes: uploadedPdf.bytes,
			};
		}

		if (uploadedThumbnail) {
			createPayload.thumbnail = {
				url: uploadedThumbnail.url,
				publicId: uploadedThumbnail.publicId,
				bytes: uploadedThumbnail.bytes,
			};
		}

		const lesson = await Lesson.create(createPayload);

		return {
			statusCode: 201,
			data: {
				message: 'Lesson created successfully',
				lesson,
			},
		};
	} catch (error) {
		await cleanupUploadedAssets(uploadedAssets);
		return {
			statusCode: 400,
			data: {
				message: (error as Error).message || 'Failed to create lesson',
			},
		};
	}
};

export const getLessonsByCourse = async (
	courseId: string,
	viewer: ViewerContext,
): Promise<ServiceResult> => {
	if (!isValidObjectId(courseId)) {
		return { statusCode: 400, data: { message: 'Invalid course id' } };
	}

	const course = await Course.findById(courseId).select('_id instructor');
	if (!course) {
		return { statusCode: 404, data: { message: 'Course not found' } };
	}

	const canManage = canManageCourse(String(course.instructor), viewer);

	const filter: {
		course: Types.ObjectId;
		isPublished?: boolean;
		isPreview?: boolean;
	} = {
		course: new Types.ObjectId(courseId),
	};

	if (!canManage) {
		filter.isPublished = true;

		const isEnrolled = await Enrollment.findOne({
			course: new Types.ObjectId(courseId),
			student: new Types.ObjectId(viewer.userId),
		}).select('_id');

		if (!isEnrolled) {
			filter.isPreview = true;
		}
	}

	const lessons = await Lesson.find(filter).sort({ order: 1, createdAt: 1 });

	// ✅ للمستخدم غير المسجل: أخفِ URLs المحتوى من الدروس العادية (غير المعاينة)
	// الـ filter يُرجع فقط preview للزائر، لكن كتابة هذا صريحاً أفضل للأمان
	const safeLessons = canManage
		? lessons
		: lessons.map((lesson) => {
				if (lesson.isPreview) return lesson;
				// حذف URLs المحتوى الحساسة من قائمة الدروس إن وُجدت
				const obj = lesson.toObject();
				delete obj.video;
				delete obj.pdf;
				delete obj.thumbnail;
				return obj;
		  });

	return {
		statusCode: 200,
		data: {
			lessons: safeLessons,
			total: safeLessons.length,
		},
	};
};

export const getLessonById = async (
	lessonId: string,
	viewer: ViewerContext,
): Promise<ServiceResult> => {
	if (!isValidObjectId(lessonId)) {
		return { statusCode: 400, data: { message: 'Invalid lesson id' } };
	}

	const lesson = await Lesson.findById(lessonId);
	if (!lesson) {
		return { statusCode: 404, data: { message: 'Lesson not found' } };
	}

	const course = await Course.findById(lesson.course).select('_id instructor');
	if (!course) {
		return { statusCode: 404, data: { message: 'Course not found' } };
	}

	const canManage = canManageCourse(String(course.instructor), viewer);
	if (!canManage) {
		if (!lesson.isPublished) {
			return { statusCode: 404, data: { message: 'Lesson not found' } };
		}

		if (!lesson.isPreview) {
			const isEnrolled = await Enrollment.findOne({
				course: lesson.course,
				student: new Types.ObjectId(viewer.userId),
			}).select('_id');

			if (!isEnrolled) {
				return { statusCode: 403, data: { message: 'You are not enrolled in this course' } };
			}
		}
	}

	return {
		statusCode: 200,
		data: { lesson },
	};
};

export const updateLesson = async (
	lessonId: string,
	payload: LessonWritePayload,
	files: LessonMediaFiles,
	viewer: ViewerContext,
): Promise<ServiceResult> => {
	// ✅ فقط الأستاذ يعدّل الدروس
	if (viewer.role !== 'teacher') {
		return { statusCode: 403, data: { message: 'Only teachers can update lessons' } };
	}

	if (!isValidObjectId(lessonId)) {
		return { statusCode: 400, data: { message: 'Invalid lesson id' } };
	}

	const lesson = await Lesson.findById(lessonId);
	if (!lesson) {
		return { statusCode: 404, data: { message: 'Lesson not found' } };
	}

	const permissionResult = await getCourseWithPermissionCheck(String(lesson.course), viewer);
	if (permissionResult.error) {
		return permissionResult.error;
	}

	if (payload.course && payload.course !== String(lesson.course)) {
		return { statusCode: 400, data: { message: 'Changing lesson course is not allowed' } };
	}

	const filesValidation = validateUploadedFileTypes(files);
	if (filesValidation) {
		return filesValidation;
	}

	const uploadedAssets: Array<{ publicId: string; resourceType: 'image' | 'raw' }> = [];

	try {
		const [uploadedPdf, uploadedThumbnail] = await Promise.all([
			files.pdf
				? uploadToCloudinary(files.pdf.buffer, 'acadtrak/lessons/pdfs', 'raw')
				: Promise.resolve(undefined),
			files.thumbnail
				? uploadToCloudinary(files.thumbnail.buffer, 'acadtrak/lessons/thumbnails', 'image')
				: Promise.resolve(undefined),
		]);

		if (uploadedPdf) {
			uploadedAssets.push({ publicId: uploadedPdf.publicId, resourceType: 'raw' });
		}

		if (uploadedThumbnail) {
			uploadedAssets.push({ publicId: uploadedThumbnail.publicId, resourceType: 'image' });
		}

		if (payload.title !== undefined) {
			const title = normalizeTitle(payload.title);
			if (!title || title.length < 2) {
				await cleanupUploadedAssets(uploadedAssets);
				return { statusCode: 400, data: { message: 'Title must be at least 2 characters' } };
			}
			lesson.title = title;
		}

		if (payload.description !== undefined) {
			const description = normalizeDescription(payload.description);
			if (description === undefined) {
				lesson.set('description', undefined);
			} else {
				lesson.description = description;
			}
		}

		if (payload.order !== undefined) {
			if (payload.order < 0) {
				await cleanupUploadedAssets(uploadedAssets);
				return { statusCode: 400, data: { message: 'Order must be greater than or equal to 0' } };
			}
			lesson.order = payload.order;
		}

		if (payload.isPreview !== undefined) {
			lesson.isPreview = payload.isPreview;
		}

		if (payload.isPublished !== undefined) {
			lesson.isPublished = payload.isPublished;
		}

		if (payload.removeVideo) {
			lesson.set('video', undefined);
		}

		if (payload.video) {
			const videoValidation = validateVideo(payload.video);
			if (!videoValidation.valid || !videoValidation.value) {
				await cleanupUploadedAssets(uploadedAssets);
				return {
					statusCode: 400,
					data: { message: videoValidation.valid ? 'Invalid video payload' : videoValidation.message },
				};
			}
			lesson.video = videoValidation.value;
		}

		const oldPdfPublicId = lesson.pdf?.publicId;
		const oldThumbnailPublicId = lesson.thumbnail?.publicId;

		if (payload.removePdf) {
			lesson.set('pdf', undefined);
		}

		if (payload.removeThumbnail) {
			lesson.set('thumbnail', undefined);
		}

		if (uploadedPdf) {
			lesson.pdf = {
				url: uploadedPdf.url,
				publicId: uploadedPdf.publicId,
				bytes: uploadedPdf.bytes,
			};
		}

		if (uploadedThumbnail) {
			lesson.thumbnail = {
				url: uploadedThumbnail.url,
				publicId: uploadedThumbnail.publicId,
				bytes: uploadedThumbnail.bytes,
			};
		}

		const hasVideo = Boolean(lesson.video?.youtubeId);
		const hasPdf = Boolean(lesson.pdf?.url);
		if (!hasVideo && !hasPdf) {
			await cleanupUploadedAssets(uploadedAssets);
			return { statusCode: 400, data: { message: 'Lesson must have at least a YouTube video or a PDF' } };
		}

		await lesson.save();

		const oldAssetsToDelete: Array<{ publicId: string; resourceType: 'image' | 'raw' }> = [];

		if (oldPdfPublicId && (payload.removePdf || Boolean(uploadedPdf)) && oldPdfPublicId !== lesson.pdf?.publicId) {
			oldAssetsToDelete.push({ publicId: oldPdfPublicId, resourceType: 'raw' });
		}

		if (
			oldThumbnailPublicId &&
			(payload.removeThumbnail || Boolean(uploadedThumbnail)) &&
			oldThumbnailPublicId !== lesson.thumbnail?.publicId
		) {
			oldAssetsToDelete.push({ publicId: oldThumbnailPublicId, resourceType: 'image' });
		}

		await cleanupUploadedAssets(oldAssetsToDelete);

		return {
			statusCode: 200,
			data: {
				message: 'Lesson updated successfully',
				lesson,
			},
		};
	} catch (error) {
		await cleanupUploadedAssets(uploadedAssets);
		return {
			statusCode: 400,
			data: { message: (error as Error).message || 'Failed to update lesson' },
		};
	}
};

export const deleteLesson = async (
	lessonId: string,
	viewer: ViewerContext,
): Promise<ServiceResult> => {
	// ✅ فقط الأستاذ يحذف الدروس
	if (viewer.role !== 'teacher') {
		return { statusCode: 403, data: { message: 'Only teachers can delete lessons' } };
	}

	if (!isValidObjectId(lessonId)) {
		return { statusCode: 400, data: { message: 'Invalid lesson id' } };
	}

	const lesson = await Lesson.findById(lessonId);
	if (!lesson) {
		return { statusCode: 404, data: { message: 'Lesson not found' } };
	}

	const permissionResult = await getCourseWithPermissionCheck(String(lesson.course), viewer);
	if (permissionResult.error) {
		return permissionResult.error;
	}

	const pdfPublicId = lesson.pdf?.publicId;
	const thumbnailPublicId = lesson.thumbnail?.publicId;

	await Lesson.deleteOne({ _id: lesson._id });

	const assetsToDelete: Array<{ publicId: string; resourceType: 'image' | 'raw' }> = [];
	if (pdfPublicId) {
		assetsToDelete.push({ publicId: pdfPublicId, resourceType: 'raw' });
	}
	if (thumbnailPublicId) {
		assetsToDelete.push({ publicId: thumbnailPublicId, resourceType: 'image' });
	}

	await cleanupUploadedAssets(assetsToDelete);

	return {
		statusCode: 200,
		data: { message: 'Lesson deleted successfully' },
	};
};
