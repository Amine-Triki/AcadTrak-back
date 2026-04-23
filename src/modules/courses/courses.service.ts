import { Types } from 'mongoose';
import { Course, getCoursePriceWithCoupon, type CourseDocument, type ICourseCoupon } from './course.model.js';
import { courseSchema, updateCourseSchema, type CreateCourseInput, type UpdateCourseInput } from './course-validation.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { isValidObjectId } from '../../utils/mongo.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';

const getRefId = (value: unknown) => {
	if (value instanceof Types.ObjectId) {
		return String(value);
	}

	if (typeof value === 'string') {
		return value;
	}

	if (value && typeof value === 'object' && '_id' in value) {
		const idValue = (value as { _id?: unknown })._id;
		if (idValue instanceof Types.ObjectId) {
			return String(idValue);
		}

		if (typeof idValue === 'string') {
			return idValue;
		}
	}

	return '';
};

const getCategoryDetails = (value: unknown) => {
	if (value && typeof value === 'object' && 'name' in value) {
		const obj = value as { _id?: unknown; name?: unknown; slug?: unknown };
		const name = typeof obj.name === 'string' ? obj.name.trim() : '';
		const slug = typeof obj.slug === 'string' ? obj.slug.trim() : '';

		if (name) {
			return {
				id: getRefId(value),
				name,
				...(slug ? { slug } : {}),
			};
		}
	}

	return undefined;
};

const getInstructorDetails = (value: unknown) => {
	if (value && typeof value === 'object') {
		const obj = value as {
			firstName?: unknown;
			lastName?: unknown;
			userName?: unknown;
		};

		const firstName = typeof obj.firstName === 'string' ? obj.firstName.trim() : '';
		const lastName = typeof obj.lastName === 'string' ? obj.lastName.trim() : '';
		const userName = typeof obj.userName === 'string' ? obj.userName.trim() : '';
		const name = `${firstName} ${lastName}`.trim() || userName;

		if (name) {
			return {
				id: getRefId(value),
				name,
				...(userName ? { userName } : {}),
			};
		}
	}

	return undefined;
};

const toCourseResponse = async (
	course: CourseDocument,
	canSeeHidden: boolean,
	couponCode?: string,
) => {
	const categoryId = getRefId(course.category);
	const instructorId = getRefId(course.instructor);
	const categoryDetails = getCategoryDetails(course.category);
	const instructorDetails = getInstructorDetails(course.instructor);

	return {
		id: String(course._id),
		title: course.title,
		slug: course.slug,
		description: course.description,
		instructor: instructorId,
		category: categoryId,
		...(categoryDetails ? { categoryDetails } : {}),
		...(instructorDetails ? { instructorDetails } : {}),
		status: course.status,
		type: course.type,
		price: course.price,
		effectivePrice: getCoursePriceWithCoupon(course, couponCode),
		thumbnail: course.thumbnail,
		averageRating: course.averageRating,
		totalRatingsCount: course.totalRatingsCount,
		isHidden: course.isHidden,
		hiddenAt: course.hiddenAt,
		coupon: course.coupon as ICourseCoupon | undefined,
		canSeeHidden,
	};
};

export const createCourse = async (
	payload: CreateCourseInput,
	authUser: ViewerContext,
): Promise<ServiceResult> => {
	try {
		if (authUser.role !== 'teacher' && authUser.role !== 'admin') {
			return { statusCode: 403, data: { message: 'Only teachers or admins can create courses' } };
		}

		const validated = courseSchema.parse(payload);

		const createPayload: {
			title: string;
			description: string;
			category: Types.ObjectId;
			type: 'free' | 'paid';
			price: number;
			instructor: Types.ObjectId;
			status?: 'draft' | 'published';
			thumbnail?: string;
		} = {
			title: validated.title,
			description: validated.description,
			category: new Types.ObjectId(validated.category),
			type: validated.type,
			price: validated.type === 'free' ? 0 : (validated.price as number),
			instructor: new Types.ObjectId(authUser.userId),
		};

		if (validated.status) {
			createPayload.status = validated.status;
		}

		if (validated.thumbnail) {
			createPayload.thumbnail = validated.thumbnail;
		}

		const created = await Course.create(createPayload);

		const saved = await Course.findById(created._id);
		if (!saved) {
			return { statusCode: 500, data: { message: 'Failed to create course' } };
		}

		await saved.populate([
			{ path: 'category', select: 'name slug' },
			{ path: 'instructor', select: 'firstName lastName userName' },
		]);

		return {
			statusCode: 201,
			data: {
				message: 'Course created successfully',
				course: await toCourseResponse(saved, true),
			},
		};
	} catch (error) {
		return {
			statusCode: 400,
			data: { message: (error as Error).message || 'Invalid course payload' },
		};
	}
};

export const getAllCourses = async (viewer?: ViewerContext): Promise<ServiceResult> => {
	const courses = await Course.find().sort({ createdAt: -1 });

	let enrolledCourseIds = new Set<string>();
	if (viewer) {
		const enrollments = await Enrollment.find({
			student: new Types.ObjectId(viewer.userId),
		}).select('course');

		enrolledCourseIds = new Set(
			enrollments.map((enrollment) => String(enrollment.course)),
		);
	}

	const visibleDocs = courses.filter((course) => {
		const instructorId = getRefId(course.instructor);
		const canSeeHidden =
			!course.isHidden ||
			Boolean(
				viewer && (
					instructorId === viewer.userId ||
					viewer.role === 'admin' ||
					enrolledCourseIds.has(String(course._id))
				),
			);

		if (!canSeeHidden) {
			return false;
		}

		if (!viewer) {
			return course.status === 'published';
		}

		return true;
	});

	await Course.populate(visibleDocs, [
		{ path: 'category', select: 'name slug' },
		{ path: 'instructor', select: 'firstName lastName userName' },
	]);

	const visible = await Promise.all(visibleDocs.map((course) => toCourseResponse(course, true)));

	return {
		statusCode: 200,
		data: {
			courses: visible,
			total: visible.length,
		},
	};
};

export const getCourseById = async (
	courseId: string,
	viewer?: ViewerContext,
	couponCode?: string,
): Promise<ServiceResult> => {
	if (!isValidObjectId(courseId)) {
		return { statusCode: 400, data: { message: 'Invalid course id' } };
	}

	const course = await Course.findById(courseId);
	if (!course) {
		return { statusCode: 404, data: { message: 'Course not found' } };
	}

	if (!viewer && course.status !== 'published') {
		return { statusCode: 404, data: { message: 'Course not found' } };
	}

	let canSeeHidden = !course.isHidden;
	if (!canSeeHidden && viewer) {
		canSeeHidden =
			getRefId(course.instructor) === viewer.userId ||
			viewer.role === 'admin' ||
			Boolean(await Enrollment.findOne({
				student: new Types.ObjectId(viewer.userId),
				course: course._id,
			}).select('_id'));
	}

	await course.populate([
		{ path: 'category', select: 'name slug' },
		{ path: 'instructor', select: 'firstName lastName userName' },
	]);

	const mapped = await toCourseResponse(course, canSeeHidden, couponCode);

	if (!mapped.canSeeHidden) {
		return { statusCode: 404, data: { message: 'Course not found' } };
	}

	return { statusCode: 200, data: { course: mapped } };
};

export const updateCourse = async (
	courseId: string,
	payload: UpdateCourseInput,
	viewer: ViewerContext,
): Promise<ServiceResult> => {
	if (!isValidObjectId(courseId)) {
		return { statusCode: 400, data: { message: 'Invalid course id' } };
	}

	const course = await Course.findById(courseId);
	if (!course) {
		return { statusCode: 404, data: { message: 'Course not found' } };
	}

	const isOwner = String(course.instructor) === viewer.userId;
	if (!isOwner && viewer.role !== 'admin') {
		return { statusCode: 403, data: { message: 'You are not allowed to update this course' } };
	}

	try {
		const validated = updateCourseSchema.parse(payload);

		Object.assign(course, validated);
		if (validated.type === 'free') {
			course.price = 0;
		}

		await course.save();
		await course.populate([
			{ path: 'category', select: 'name slug' },
			{ path: 'instructor', select: 'firstName lastName userName' },
		]);

		return {
			statusCode: 200,
			data: {
				message: 'Course updated successfully',
				course: await toCourseResponse(course, true),
			},
		};
	} catch (error) {
		return {
			statusCode: 400,
			data: { message: (error as Error).message || 'Invalid update payload' },
		};
	}
};

export const deleteOrHideCourse = async (
	courseId: string,
	viewer: ViewerContext,
): Promise<ServiceResult> => {
	if (!isValidObjectId(courseId)) {
		return { statusCode: 400, data: { message: 'Invalid course id' } };
	}

	const course = await Course.findById(courseId);
	if (!course) {
		return { statusCode: 404, data: { message: 'Course not found' } };
	}

	const isOwner = String(course.instructor) === viewer.userId;
	if (!isOwner && viewer.role !== 'admin') {
		return { statusCode: 403, data: { message: 'You are not allowed to delete this course' } };
	}

	if (course.type === 'free') {
		await Course.deleteOne({ _id: course._id });
		return {
			statusCode: 200,
			data: { message: 'Free course deleted permanently' },
		};
	}

	course.isHidden = true;
	course.hiddenAt = new Date();
	await course.save();
	await course.populate([
		{ path: 'category', select: 'name slug' },
		{ path: 'instructor', select: 'firstName lastName userName' },
	]);

	return {
		statusCode: 200,
		data: {
			message: 'Paid course was hidden from catalog and remains accessible to enrolled students',
			course: await toCourseResponse(course, true),
		},
	};
};
