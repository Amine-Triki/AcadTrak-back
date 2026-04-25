import { Types } from 'mongoose';
import { Course } from '../courses/course.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Lesson } from '../lessons/lesson.model.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';
import { isValidObjectId } from '../../utils/mongo.js';
import { Discussion, type DiscussionDocument } from './discussion.model.js';
import type {
  AnswerDiscussionInput,
  CreateDiscussionInput,
  UpdateDiscussionInput,
} from './discussion-validation.js';

const getObjectId = (value: unknown) => {
  if (value instanceof Types.ObjectId) {
    return String(value);
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

  if (typeof value === 'string') {
    return value;
  }

  return '';
};

const toUserPayload = (value: unknown) => {
  const id = getObjectId(value);

  if (!value || typeof value !== 'object') {
    return {
      id,
      userName: 'Unknown User',
      displayName: 'Unknown User',
    };
  }

  const user = value as {
    userName?: unknown;
    firstName?: unknown;
    lastName?: unknown;
  };

  const userName = typeof user.userName === 'string' && user.userName.trim()
    ? user.userName.trim()
    : 'Unknown User';

  const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
  const displayName = `${firstName} ${lastName}`.trim() || userName;

  return {
    id,
    userName,
    displayName,
  };
};

const toLessonPayload = (value: unknown) => {
  if (!value) {
    return undefined;
  }

  if (value && typeof value === 'object') {
    const lesson = value as { _id?: unknown; title?: unknown; order?: unknown };
    const id = getObjectId(value);
    const title = typeof lesson.title === 'string' ? lesson.title : undefined;
    const order = typeof lesson.order === 'number' ? lesson.order : undefined;

    return {
      id,
      ...(title ? { title } : {}),
      ...(order !== undefined ? { order } : {}),
    };
  }

  const id = getObjectId(value);
  return id ? { id } : undefined;
};

const toDiscussionResponse = (discussion: DiscussionDocument) => {
  const student = toUserPayload(discussion.student);
  const answerBy = discussion.answerBy ? toUserPayload(discussion.answerBy) : undefined;
  const lesson = toLessonPayload(discussion.lesson);

  const isDeleted = Boolean(discussion.deletedAt);

  return {
    id: String(discussion._id),
    course: String(discussion.course),
    ...(lesson ? { lesson } : {}),
    student,
    question: isDeleted ? null : discussion.question,
    isQuestionEdited: Boolean(discussion.questionEditedAt),
    questionEditedAt: discussion.questionEditedAt,
    answer: discussion.answer,
    answerBy,
    isAnswerEdited: Boolean(discussion.answerEditedAt),
    answerEditedAt: discussion.answerEditedAt,
    isResolved: discussion.isResolved,
    isDeleted,
    deletedAt: discussion.deletedAt,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
  };
};

const canManageCourse = (courseInstructorId: string, viewer: ViewerContext) => {
  // ✅ فقط الأستاذ صاحب الدورة يستطيع الإدارة — Admin لا يملك هذا
  return viewer.role === 'teacher' && courseInstructorId === viewer.userId;
};

const canAccessCourseDiscussions = async (
  courseId: string,
  viewer: ViewerContext,
) => {
  if (!isValidObjectId(courseId)) {
    return {
      error: { statusCode: 400, data: { message: 'Invalid course id' } },
    };
  }

  const course = await Course.findById(courseId).select('_id instructor type');
  if (!course) {
    return {
      error: { statusCode: 404, data: { message: 'Course not found' } },
    };
  }

  if (canManageCourse(String(course.instructor), viewer)) {
    return { course, canManage: true };
  }

  const isEnrolled = await Enrollment.findOne({
    course: new Types.ObjectId(courseId),
    student: new Types.ObjectId(viewer.userId),
  }).select('_id');

  if (!isEnrolled) {
    return {
      error: { statusCode: 403, data: { message: 'You are not enrolled in this course' } },
    };
  }

  return { course, canManage: false };
};

const ensureLessonBelongsToCourse = async (lessonId: string, courseId: string) => {
  if (!isValidObjectId(lessonId)) {
    return { valid: false as const, message: 'Invalid lesson id' };
  }

  const lesson = await Lesson.findOne({
    _id: new Types.ObjectId(lessonId),
    course: new Types.ObjectId(courseId),
  }).select('_id');

  if (!lesson) {
    return { valid: false as const, message: 'Lesson not found for this course' };
  }

  return { valid: true as const };
};

export const listCourseDiscussions = async (
  courseId: string,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  const permission = await canAccessCourseDiscussions(courseId, viewer);
  if (permission.error) {
    return permission.error;
  }

  const discussions = await Discussion.find({
    course: new Types.ObjectId(courseId),
  })
    .populate('student', 'userName firstName lastName')
    .populate('answerBy', 'userName firstName lastName')
    .populate('lesson', 'title order')
    .sort({ createdAt: -1 });

  return {
    statusCode: 200,
    data: {
      discussions: discussions.map(toDiscussionResponse),
      total: discussions.length,
    },
  };
};

export const createDiscussion = async (
  payload: CreateDiscussionInput,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  const permission = await canAccessCourseDiscussions(payload.course, viewer);
  if (permission.error) {
    return permission.error;
  }

  // ✅ صاحب الدورة (الأستاذ) لا يسأل في دورته هو — فقط المسجلون يسألون
  // الأستاذ المسجل في دورة أستاذ آخر → canManage=false → مسموح له بالسؤال
  if (permission.canManage) {
    return { statusCode: 403, data: { message: 'Course instructors cannot post questions in their own course' } };
  }

  if (payload.lesson) {
    const lessonValidation = await ensureLessonBelongsToCourse(payload.lesson, payload.course);
    if (!lessonValidation.valid) {
      return { statusCode: 400, data: { message: lessonValidation.message } };
    }
  }

  const discussion = await Discussion.create({
    course: new Types.ObjectId(payload.course),
    ...(payload.lesson ? { lesson: new Types.ObjectId(payload.lesson) } : {}),
    student: new Types.ObjectId(viewer.userId),
    question: payload.question,
    isResolved: false,
  });

  await discussion.populate([
    { path: 'student', select: 'userName firstName lastName' },
    { path: 'lesson', select: 'title order' },
  ]);

  return {
    statusCode: 201,
    data: {
      message: 'Question created successfully',
      discussion: toDiscussionResponse(discussion),
    },
  };
};

export const updateDiscussionQuestion = async (
  discussionId: string,
  payload: UpdateDiscussionInput,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  if (!isValidObjectId(discussionId)) {
    return { statusCode: 400, data: { message: 'Invalid discussion id' } };
  }

  const discussion = await Discussion.findById(discussionId);
  if (!discussion) {
    return { statusCode: 404, data: { message: 'Discussion not found' } };
  }

  const permission = await canAccessCourseDiscussions(String(discussion.course), viewer);
  if (permission.error) {
    return permission.error;
  }

  if (discussion.deletedAt) {
    return { statusCode: 400, data: { message: 'Deleted questions cannot be edited' } };
  }

  // ✅ صاحب السؤال فقط يعدله — بصرف النظر عن الـ role (student أو teacher مسجل)
  const isOwner = String(discussion.student) === viewer.userId;
  if (!isOwner) {
    return { statusCode: 403, data: { message: 'You are not allowed to edit this question' } };
  }

  if (payload.lesson) {
    const lessonValidation = await ensureLessonBelongsToCourse(payload.lesson, String(discussion.course));
    if (!lessonValidation.valid) {
      return { statusCode: 400, data: { message: lessonValidation.message } };
    }
  }

  if (payload.question !== undefined) {
    discussion.question = payload.question;
    discussion.questionEditedAt = new Date();
  }

  if (payload.lesson !== undefined) {
    discussion.lesson = new Types.ObjectId(payload.lesson);
  }

  await discussion.save();
  await discussion.populate([
    { path: 'student', select: 'userName firstName lastName' },
    { path: 'answerBy', select: 'userName firstName lastName' },
    { path: 'lesson', select: 'title order' },
  ]);

  return {
    statusCode: 200,
    data: {
      message: 'Question updated successfully',
      discussion: toDiscussionResponse(discussion),
    },
  };
};

export const softDeleteDiscussion = async (
  discussionId: string,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  if (!isValidObjectId(discussionId)) {
    return { statusCode: 400, data: { message: 'Invalid discussion id' } };
  }

  const discussion = await Discussion.findById(discussionId);
  if (!discussion) {
    return { statusCode: 404, data: { message: 'Discussion not found' } };
  }

  const permission = await canAccessCourseDiscussions(String(discussion.course), viewer);
  if (permission.error) {
    return permission.error;
  }

  // ✅ صاحب السؤال يمكنه حذفه — بصرف النظر عن الـ role (student أو teacher مسجل)
  const isOwner = String(discussion.student) === viewer.userId;

  if (!isOwner) {
    return { statusCode: 403, data: { message: 'You are not allowed to delete this question' } };
  }

  if (discussion.deletedAt) {
    return { statusCode: 200, data: { message: 'Question already deleted' } };
  }

  discussion.deletedAt = new Date();
  discussion.deletedBy = new Types.ObjectId(viewer.userId);
  await discussion.save();

  return {
    statusCode: 200,
    data: {
      message: 'Question deleted successfully',
    },
  };
};

export const answerDiscussion = async (
  discussionId: string,
  payload: AnswerDiscussionInput,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  // ✅ فقط الأستاذ صاحب الدورة يجيب — Admin لا يمكنه الإجابة
  if (viewer.role !== 'teacher') {
    return { statusCode: 403, data: { message: 'Only teachers can answer questions' } };
  }

  if (!isValidObjectId(discussionId)) {
    return { statusCode: 400, data: { message: 'Invalid discussion id' } };
  }

  const discussion = await Discussion.findById(discussionId);
  if (!discussion) {
    return { statusCode: 404, data: { message: 'Discussion not found' } };
  }

  const permission = await canAccessCourseDiscussions(String(discussion.course), viewer);
  if (permission.error) {
    return permission.error;
  }

  if (!permission.canManage) {
    return { statusCode: 403, data: { message: 'You are not allowed to answer in this course' } };
  }

  if (discussion.deletedAt) {
    return { statusCode: 400, data: { message: 'Cannot answer a deleted question' } };
  }

  if (discussion.answer && discussion.answer !== payload.answer) {
    discussion.answerEditedAt = new Date();
  }

  discussion.answer = payload.answer;
  discussion.answerBy = new Types.ObjectId(viewer.userId);
  discussion.isResolved = true;

  await discussion.save();
  await discussion.populate([
    { path: 'student', select: 'userName firstName lastName' },
    { path: 'answerBy', select: 'userName firstName lastName' },
    { path: 'lesson', select: 'title order' },
  ]);

  return {
    statusCode: 200,
    data: {
      message: 'Answer saved successfully',
      discussion: toDiscussionResponse(discussion),
    },
  };
};
