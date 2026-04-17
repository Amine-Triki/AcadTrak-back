import { Types } from 'mongoose';
import { Course, getCoursePriceWithCoupon } from '../courses/course.model.js';
import { Enrollment } from './enrollment.model.js';
import { isValidObjectId } from '../../utils/mongo.js';

type UserRole = 'student' | 'teacher' | 'admin';

interface ServiceResult {
  statusCode: number;
  data: unknown;
}

interface ViewerContext {
  userId: string;
  role: UserRole;
}

export const isUserEnrolledInCourse = async (userId: string, courseId: string) => {
  if (!isValidObjectId(userId) || !isValidObjectId(courseId)) {
    return false;
  }

  const enrollment = await Enrollment.findOne({
    student: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
  }).select('_id');

  return Boolean(enrollment);
};

export const enrollInCourse = async (
  courseId: string,
  viewer: ViewerContext,
  couponCode?: string,
): Promise<ServiceResult> => {
  if (!isValidObjectId(courseId)) {
    return { statusCode: 400, data: { message: 'Invalid course id' } };
  }

  if (viewer.role !== 'student' && viewer.role !== 'admin') {
    return { statusCode: 403, data: { message: 'Only students can enroll in courses' } };
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return { statusCode: 404, data: { message: 'Course not found' } };
  }

  const alreadyEnrolled = await Enrollment.findOne({
    student: new Types.ObjectId(viewer.userId),
    course: course._id,
  }).select('_id');

  if (alreadyEnrolled) {
    return { statusCode: 409, data: { message: 'You are already enrolled in this course' } };
  }

  const paidPrice = getCoursePriceWithCoupon(course, couponCode);

  const payload: {
    student: Types.ObjectId;
    course: Types.ObjectId;
    paidPrice: number;
    couponCode?: string;
  } = {
    student: new Types.ObjectId(viewer.userId),
    course: course._id as Types.ObjectId,
    paidPrice,
  };

  if (couponCode?.trim()) {
    payload.couponCode = couponCode.trim().toUpperCase();
  }

  const enrollment = await Enrollment.create(payload);

  return {
    statusCode: 201,
    data: {
      message: 'Enrolled successfully',
      enrollment: {
        id: String(enrollment._id),
        student: enrollment.student,
        course: enrollment.course,
        paidPrice: enrollment.paidPrice,
        couponCode: enrollment.couponCode,
        enrolledAt: enrollment.enrolledAt,
      },
    },
  };
};

export const getMyEnrollments = async (viewer: ViewerContext): Promise<ServiceResult> => {
  const enrollments = await Enrollment.find({
    student: new Types.ObjectId(viewer.userId),
  })
    .populate({
      path: 'course',
      select: 'title slug description thumbnail type status price isHidden hiddenAt',
    })
    .sort({ createdAt: -1 });

  return {
    statusCode: 200,
    data: {
      enrollments,
      total: enrollments.length,
    },
  };
};
