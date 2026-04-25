import { Types } from 'mongoose';
import { Course, getCoursePriceWithCoupon } from '../courses/course.model.js';
import { Enrollment } from './enrollment.model.js';
import { isValidObjectId } from '../../utils/mongo.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';

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

  // ✅ فقط Student وTeacher يمكنهم التسجيل — Admin مراقب فقط
  if (!['student', 'teacher'].includes(viewer.role)) {
    return { statusCode: 403, data: { message: 'Only students and teachers can enroll in courses' } };
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
    paymentProvider?: 'konnect' | 'coupon_100' | 'free';
  } = {
    student: new Types.ObjectId(viewer.userId),
    course: course._id as Types.ObjectId,
    paidPrice,
  };

  if (couponCode?.trim()) {
    payload.couponCode = couponCode.trim().toUpperCase();
  }

  // Fix #5: Set paymentProvider for free or coupon enrollment
  if (course.type === 'free') {
    payload.paymentProvider = 'free';
  } else if (paidPrice === 0 && couponCode?.trim()) {
    // 100% discount coupon
    payload.paymentProvider = 'coupon_100';
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

export const getCourseEnrollments = async (
  courseId: string,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  if (!isValidObjectId(courseId)) {
    return { statusCode: 400, data: { message: 'Invalid course id' } };
  }

  const course = await Course.findById(courseId).select('_id title instructor');
  if (!course) {
    return { statusCode: 404, data: { message: 'Course not found' } };
  }

  const isOwner = String(course.instructor) === viewer.userId;
  // ✅ فقط الأستاذ صاحب الدورة يرى enrollments دورته
  if (!(viewer.role === 'teacher' && isOwner)) {
    return { statusCode: 403, data: { message: 'You are not allowed to view this course enrollments' } };
  }

  const enrollments = await Enrollment.find({
    course: new Types.ObjectId(courseId),
  })
    .populate({
      path: 'student',
      select: '_id firstName lastName userName email country role deletedAt',
    })
    .sort({ createdAt: -1 });

  return {
    statusCode: 200,
    data: {
      course: {
        id: String(course._id),
        title: course.title,
      },
      enrollments,
      total: enrollments.length,
    },
  };
};

export const getTeacherStudents = async (viewer: ViewerContext): Promise<ServiceResult> => {
  // ✅ فقط الأستاذ يرى طلابه — Admin ليس لديه دورات
  if (viewer.role !== 'teacher') {
    return { statusCode: 403, data: { message: 'Only teachers can view their students' } };
  }

  const courseQuery = { instructor: new Types.ObjectId(viewer.userId) };

  const courses = await Course.find(courseQuery).select('_id title').lean();
  const courseMap = new Map(courses.map((course) => [String(course._id), course.title]));
  const courseIds = Array.from(courseMap.keys()).map((id) => new Types.ObjectId(id));

  if (courseIds.length === 0) {
    return {
      statusCode: 200,
      data: {
        students: [],
        total: 0,
      },
    };
  }

  const enrollments = await Enrollment.find({
    course: { $in: courseIds },
  })
    .populate({
      path: 'student',
      select: '_id firstName lastName userName email country role',
    })
    .select('student course paidPrice couponCode enrolledAt')
    .sort({ enrolledAt: -1 })
    .lean();

  const students = enrollments
    .map((enrollment) => {
      const student = enrollment.student as {
        _id?: unknown;
        firstName?: string;
        lastName?: string;
        userName?: string;
        email?: string;
        country?: string;
        role?: string;
      } | null;

      if (!student || !student._id) {
        return null;
      }

      return {
        id: String(student._id),
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        userName: student.userName || '',
        email: student.email || '',
        country: student.country || '',
        role: student.role || 'student',
        courseId: String(enrollment.course),
        courseTitle: courseMap.get(String(enrollment.course)) || 'Course',
        paidPrice: enrollment.paidPrice,
        couponCode: enrollment.couponCode,
        enrolledAt: enrollment.enrolledAt,
      };
    })
    .filter(Boolean);

  return {
    statusCode: 200,
    data: {
      students,
      total: students.length,
    },
  };
};
