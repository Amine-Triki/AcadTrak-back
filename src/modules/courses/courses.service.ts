import { Types } from 'mongoose';
import { Course, getCoursePriceWithCoupon, type CourseDocument, type ICourseCoupon } from './course.model.js';
import { courseSchema, updateCourseSchema, type CreateCourseInput, type UpdateCourseInput } from './course-validation.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { isValidObjectId } from '../../utils/mongo.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';

const toCourseResponse = async (
	course: CourseDocument,
	canSeeHidden: boolean,
	couponCode?: string,
) => {
	return {
		id: String(course._id),
		title: course.title,
		slug: course.slug,
		description: course.description,
		instructor: course.instructor,
		category: course.category,
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
			coupon?: ICourseCoupon;
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

		if (validated.coupon) {
			const coupon: ICourseCoupon = {
				code: validated.coupon.code,
				discountType: validated.coupon.discountType,
				amount: validated.coupon.amount,
				expiresAt: validated.coupon.expiresAt,
				isActive: validated.coupon.isActive,
			};

			if (validated.coupon.startsAt) {
				coupon.startsAt = validated.coupon.startsAt;
			}

			createPayload.coupon = coupon;
		}

		const created = await Course.create(createPayload);

		const saved = await Course.findById(created._id);
		if (!saved) {
			return { statusCode: 500, data: { message: 'Failed to create course' } };
		}

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

	const mapped = await Promise.all(
		courses.map(async (course) => {
			const canSeeHidden =
				!course.isHidden ||
				Boolean(
					viewer && (
						String(course.instructor) === viewer.userId ||
						viewer.role === 'admin' ||
						enrolledCourseIds.has(String(course._id))
					),
				);

			return toCourseResponse(course, canSeeHidden);
		}),
	);

	const visible = mapped.filter((course) => course.canSeeHidden);

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

	let canSeeHidden = !course.isHidden;
	if (!canSeeHidden && viewer) {
		canSeeHidden =
			String(course.instructor) === viewer.userId ||
			viewer.role === 'admin' ||
			Boolean(await Enrollment.findOne({
				student: new Types.ObjectId(viewer.userId),
				course: course._id,
			}).select('_id'));
	}

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

	return {
		statusCode: 200,
		data: {
			message: 'Paid course was hidden from catalog and remains accessible to enrolled students',
			course: await toCourseResponse(course, true),
		},
	};
};
