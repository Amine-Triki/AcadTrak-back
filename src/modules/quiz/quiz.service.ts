import { Types } from 'mongoose';
import { Course } from '../courses/course.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Quiz } from './quiz.model.js';
import { QuizAttempt } from './quizAttempt.model.js';
import { Certificate } from './certificate.model.js';
import { isValidObjectId } from '../../utils/mongo.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';
import type { IQuestion, QuizDocument } from './quiz.model.js';
import type { CreateQuizInput, UpdateQuizInput } from './quiz-validation.js';

type QuizQuestionPayload = {
  text: string;
  options: string[];
  correctIndex?: number;
  correctIndices?: number[];
  explanation?: string | undefined;
};

const canManageCourse = (courseInstructorId: string, viewer: ViewerContext) => {
  // ✅ فقط الأستاذ صاحب الدورة — Admin لا يُدير الاختبارات
  return viewer.role === 'teacher' && courseInstructorId === viewer.userId;
};

const normalizeQuestion = (question: QuizQuestionPayload): IQuestion => {
  const correctIndices = Array.isArray(question.correctIndices)
    ? question.correctIndices.filter((value) => Number.isInteger(value)).map((value) => Number(value))
    : typeof question.correctIndex === 'number'
      ? [question.correctIndex]
      : [];

  const normalized: IQuestion = {
    text: question.text.trim(),
    options: question.options.map((option) => option.trim()),
    correctIndices,
    ...(typeof question.correctIndex === 'number' ? { correctIndex: question.correctIndex } : {}),
  };

  if (typeof question.explanation === 'string' && question.explanation.trim()) {
    normalized.explanation = question.explanation.trim();
  }

  return normalized;
};

const toQuizResponse = (quiz: QuizDocument, includeAnswerKey: boolean) => ({
  id: String(quiz._id),
  course: String(quiz.course),
  title: quiz.title,
  type: quiz.type,
  order: quiz.order,
  passingScore: quiz.passingScore,
  isPublished: quiz.isPublished,
  questions: quiz.questions.map((question) => ({
    text: question.text,
    options: question.options,
    ...(includeAnswerKey ? { correctIndices: question.correctIndices, correctIndex: question.correctIndex ?? question.correctIndices?.[0] } : {}),
    ...(includeAnswerKey ? { allowMultipleAnswers: (question.correctIndices?.length || 0) > 1 } : { allowMultipleAnswers: (question.correctIndices?.length || 0) > 1 }),
    ...(includeAnswerKey && question.explanation ? { explanation: question.explanation } : {}),
  })),
});

const getCourseForManagement = async (courseId: string, viewer: ViewerContext) => {
  if (!isValidObjectId(courseId)) {
    return { error: { statusCode: 400, data: { message: 'Invalid course id' } } };
  }

  const course = await Course.findById(courseId).select('_id instructor type');
  if (!course) {
    return { error: { statusCode: 404, data: { message: 'Course not found' } } };
  }

  if (!canManageCourse(String(course.instructor), viewer)) {
    return { error: { statusCode: 403, data: { message: 'You are not allowed to manage quizzes for this course' } } };
  }

  return { course };
};

const isDuplicateFinalExamError = (error: unknown) => {
  const err = error as { code?: number; message?: string };
  return err.code === 11000 && Boolean(err.message?.includes('course_1_type_1'));
};

export const createQuiz = async (
  payload: CreateQuizInput,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  // ✅ فقط الأستاذ صاحب الدورة
  if (viewer.role !== 'teacher') {
    return { statusCode: 403, data: { message: 'Only teachers can create quizzes' } };
  }

  const permission = await getCourseForManagement(payload.course, viewer);
  if (permission.error) {
    return permission.error;
  }

  try {
    const created = await Quiz.create({
      course: new Types.ObjectId(payload.course),
      title: payload.title.trim(),
      type: payload.type,
      order: payload.order,
      questions: payload.questions.map(normalizeQuestion),
      passingScore: payload.passingScore,
      isPublished: payload.isPublished,
    });

    return {
      statusCode: 201,
      data: {
        message: 'Quiz created successfully',
        quiz: toQuizResponse(created, true),
      },
    };
  } catch (error) {
    if (isDuplicateFinalExamError(error)) {
      return {
        statusCode: 400,
        data: { message: 'Only one final exam is allowed per course' },
      };
    }

    return {
      statusCode: 400,
      data: { message: (error as Error).message || 'Failed to create quiz' },
    };
  }
};

export const getQuizzesByCourse = async (
  courseId: string,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  if (!isValidObjectId(courseId)) {
    return { statusCode: 400, data: { message: 'Invalid course id' } };
  }

  const course = await Course.findById(courseId).select('_id instructor type');
  if (!course) {
    return { statusCode: 404, data: { message: 'Course not found' } };
  }

  const canManage = canManageCourse(String(course.instructor), viewer);

  if (!canManage && course.type === 'paid') {
    const isEnrolled = await Enrollment.findOne({
      course: course._id,
      student: new Types.ObjectId(viewer.userId),
    }).select('_id');

    if (!isEnrolled) {
      return {
        statusCode: 403,
        data: { message: 'You are not enrolled in this course' },
      };
    }
  }

  const quizzes = await Quiz.find({
    course: new Types.ObjectId(courseId),
    ...(canManage ? {} : { isPublished: true }),
  }).sort({ order: 1, createdAt: 1 });

  return {
    statusCode: 200,
    data: {
      quizzes: quizzes.map((quiz) => toQuizResponse(quiz, canManage)),
      total: quizzes.length,
    },
  };
};

export const updateQuiz = async (
  quizId: string,
  payload: UpdateQuizInput,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  // ✅ فقط الأستاذ صاحب الدورة
  if (viewer.role !== 'teacher') {
    return { statusCode: 403, data: { message: 'Only teachers can update quizzes' } };
  }

  if (!isValidObjectId(quizId)) {
    return { statusCode: 400, data: { message: 'Invalid quiz id' } };
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    return { statusCode: 404, data: { message: 'Quiz not found' } };
  }

  const permission = await getCourseForManagement(String(quiz.course), viewer);
  if (permission.error) {
    return permission.error;
  }

  if (payload.course && payload.course !== String(quiz.course)) {
    return {
      statusCode: 400,
      data: { message: 'Changing quiz course is not allowed' },
    };
  }

  if (payload.title !== undefined) {
    quiz.title = payload.title.trim();
  }

  if (payload.type !== undefined) {
    quiz.type = payload.type;
  }

  if (payload.order !== undefined) {
    quiz.order = payload.order;
  }

  if (payload.questions !== undefined) {
    quiz.questions = payload.questions.map(normalizeQuestion);
  }

  if (payload.passingScore !== undefined) {
    quiz.passingScore = payload.passingScore;
  }

  if (payload.isPublished !== undefined) {
    quiz.isPublished = payload.isPublished;
  }

  try {
    await quiz.save();

    return {
      statusCode: 200,
      data: {
        message: 'Quiz updated successfully',
        quiz: toQuizResponse(quiz, true),
      },
    };
  } catch (error) {
    if (isDuplicateFinalExamError(error)) {
      return {
        statusCode: 400,
        data: { message: 'Only one final exam is allowed per course' },
      };
    }

    return {
      statusCode: 400,
      data: { message: (error as Error).message || 'Failed to update quiz' },
    };
  }
};

export const deleteQuiz = async (
  quizId: string,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  // ✅ فقط الأستاذ صاحب الدورة
  if (viewer.role !== 'teacher') {
    return { statusCode: 403, data: { message: 'Only teachers can delete quizzes' } };
  }

  if (!isValidObjectId(quizId)) {
    return { statusCode: 400, data: { message: 'Invalid quiz id' } };
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    return { statusCode: 404, data: { message: 'Quiz not found' } };
  }

  const permission = await getCourseForManagement(String(quiz.course), viewer);
  if (permission.error) {
    return permission.error;
  }

  await Quiz.deleteOne({ _id: quiz._id });

  return {
    statusCode: 200,
    data: { message: 'Quiz deleted successfully' },
  };
};

export const submitQuizAttempt = async (
  quizId: string,
  studentAnswers: Array<number | number[]>,
  viewer: ViewerContext,
) : Promise<ServiceResult> => {
  if (!isValidObjectId(quizId)) {
    return { statusCode: 400, data: { message: 'Invalid quiz id' } };
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    return { statusCode: 404, data: { message: 'Quiz not found' } };
  }

  const course = await Course.findById(quiz.course).select('_id instructor type');
  if (!course) {
    return { statusCode: 404, data: { message: 'Course not found' } };
  }

  const canManage = canManageCourse(String(course.instructor), viewer);

  if (!quiz.isPublished && !canManage) {
    return { statusCode: 404, data: { message: 'Quiz not found' } };
  }

  if (!canManage && course.type === 'paid') {
    const isEnrolled = await Enrollment.findOne({
      course: course._id,
      student: new Types.ObjectId(viewer.userId),
    }).select('_id');

    if (!isEnrolled) {
      return {
        statusCode: 403,
        data: { message: 'You are not enrolled in this course' },
      };
    }
  }

  // حساب النتيجة
  const answers = quiz.questions.map((q, i) => {
    const rawAnswer = studentAnswers[i];
    const normalizedSelected = Array.isArray(rawAnswer)
      ? rawAnswer.filter((value) => Number.isInteger(value)).map((value) => Number(value))
      : typeof rawAnswer === 'number' && Number.isInteger(rawAnswer)
        ? [rawAnswer]
        : [];

    const correctIndices = Array.isArray(q.correctIndices) && q.correctIndices.length > 0
      ? q.correctIndices
      : typeof q.correctIndex === 'number'
        ? [q.correctIndex]
        : [];

    const selectedSorted = [...new Set(normalizedSelected)].sort((a, b) => a - b);
    const correctSorted = [...new Set(correctIndices)].sort((a, b) => a - b);
    const isCorrect = selectedSorted.length === correctSorted.length
      && selectedSorted.every((value, index) => value === correctSorted[index]);

    return {
      questionIndex: i,
      chosenIndices: selectedSorted,
      isCorrect,
    };
  });

  const correct = answers.filter(a => a.isCorrect).length;
  const score   = Math.round((correct / quiz.questions.length) * 100);
  const passed  = score >= quiz.passingScore;

  // حفظ المحاولة
  await QuizAttempt.create({
    student: new Types.ObjectId(viewer.userId),
    quiz:    quiz._id,
    course:  quiz.course,
    answers, score, passed,
  });

  // ✅ إذا اجتاز الـ final_exam → أصدر شهادة تلقائياً
  if (passed && quiz.type === 'final_exam') {
    const alreadyHas = await Certificate.findOne({
      student: new Types.ObjectId(viewer.userId),
      course:  quiz.course,
    });

    if (!alreadyHas) {
      await Certificate.create({
        student:   new Types.ObjectId(viewer.userId),
        course:    quiz.course,
        finalExam: quiz._id,
        score,
      });
    }
  }

  return {
    statusCode: 200,
    data: {
      score,
      passed,
      correctAnswers: correct,
      totalQuestions: quiz.questions.length,
      // إظهار الإجابات الصحيحة فقط بعد الانتهاء
      results: answers.map((a, i) => ({
        ...a,
        correctIndices: quiz.questions[i]?.correctIndices ?? (typeof quiz.questions[i]?.correctIndex === 'number' ? [quiz.questions[i]!.correctIndex!] : []),
        explanation:  quiz.questions[i]?.explanation,
      })),
      ...(passed && quiz.type === 'final_exam' && {
        certificateIssued: true,
        message: '🎓 تهانينا! حصلت على شهادتك'
      }),
    },
  };
};