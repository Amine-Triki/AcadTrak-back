import { Types, isValidObjectId } from 'mongoose';
import { Lesson } from '../lessons/lesson.model.js';
import { Quiz } from '../quiz/quiz.model.js';
import { QuizAttempt } from '../quiz/quizAttempt.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { LessonProgress } from './lessonProgress.model.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper: هل الطالب مسجل في الدورة؟
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ensureEnrolled = async (courseId: string, viewer: ViewerContext) => {
  const enrollment = await Enrollment.findOne({
    course:  new Types.ObjectId(courseId),
    student: new Types.ObjectId(viewer.userId),
  }).lean();
  return Boolean(enrollment);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getCourseProgress — نسبة التقدم + ما أُكمل
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const getCourseProgress = async (
  courseId: string,
  viewer: ViewerContext,
): Promise<ServiceResult> => {
  if (!isValidObjectId(courseId)) {
    return { statusCode: 400, data: { message: 'Invalid course id' } };
  }

  const enrolled = await ensureEnrolled(courseId, viewer);
  if (!enrolled) {
    return { statusCode: 403, data: { message: 'You are not enrolled in this course' } };
  }

  const courseObjId  = new Types.ObjectId(courseId);
  const studentObjId = new Types.ObjectId(viewer.userId);

  // جلب كل دروس الكورس المنشورة
  const [lessons, quizzes, completedLessons, passedAttempts] = await Promise.all([
    Lesson.find({ course: courseObjId, isPublished: true })
      .select('_id order title isPreview')
      .sort({ order: 1 })
      .lean(),
    Quiz.find({ course: courseObjId, isPublished: true, type: { $ne: 'final_exam' } })
      .select('_id order title type')
      .sort({ order: 1 })
      .lean(),
    LessonProgress.find({ course: courseObjId, student: studentObjId })
      .select('lesson')
      .lean(),
    QuizAttempt.find({ course: courseObjId, student: studentObjId, passed: true })
      .select('quiz')
      .lean(),
  ]);

  const completedLessonIds = new Set(completedLessons.map((p) => String(p.lesson)));
  const passedQuizIds      = new Set(passedAttempts.map((a) => String(a.quiz)));

  // بناء قائمة المحتوى مرتبة (دروس + اختبارات عادية)
  type ContentItem = {
    id:        string;
    type:      'lesson' | 'quiz';
    order:     number;
    title:     string;
    isPreview?: boolean;
    completed: boolean;
  };

  const contentItems: ContentItem[] = [
    ...lessons.map((l) => ({
      id:        String(l._id),
      type:      'lesson' as const,
      order:     l.order,
      title:     l.title,
      isPreview: l.isPreview,
      completed: completedLessonIds.has(String(l._id)),
    })),
    ...quizzes.map((q) => ({
      id:        String(q._id),
      type:      'quiz' as const,
      order:     q.order,
      title:     q.title,
      completed: passedQuizIds.has(String(q._id)),
    })),
  ].sort((a, b) => a.order - b.order);

  const totalItems     = contentItems.length;
  const completedItems = contentItems.filter((i) => i.completed).length;
  const progressPct    = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

  // هل يمكن فتح الاختبار النهائي؟ (كل الدروس + الاختبارات العادية مكتملة)
  const canAccessFinalExam = totalItems > 0 && completedItems === totalItems;

  // لكل عنصر: هل مفتوح؟ (Preview دائماً مفتوح، أو إذا أكمل السابق)
  const itemsWithLock = contentItems.map((item, idx) => ({
    ...item,
    isUnlocked:
      item.isPreview === true ||
      idx === 0 ||
      contentItems.slice(0, idx).every((prev) => prev.completed),
  }));

  return {
    statusCode: 200,
    data: {
      progressPct,
      completedItems,
      totalItems,
      canAccessFinalExam,
      completedLessonIds: [...completedLessonIds],
      passedQuizIds:      [...passedQuizIds],
      items:              itemsWithLock,
    },
  };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// markLessonComplete — تأشير الدرس كمكتمل
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const markLessonComplete = async (
  courseId: string,
  lessonId: string,
  viewer:   ViewerContext,
): Promise<ServiceResult> => {
  if (!isValidObjectId(courseId) || !isValidObjectId(lessonId)) {
    return { statusCode: 400, data: { message: 'Invalid id' } };
  }

  const enrolled = await ensureEnrolled(courseId, viewer);
  if (!enrolled) {
    return { statusCode: 403, data: { message: 'You are not enrolled in this course' } };
  }

  // التحقق من أن الدرس تابع للكورس
  const lesson = await Lesson.findOne({
    _id:         new Types.ObjectId(lessonId),
    course:      new Types.ObjectId(courseId),
    isPublished: true,
  }).lean();

  if (!lesson) {
    return { statusCode: 404, data: { message: 'Lesson not found' } };
  }

  // ✅ التحقق من الترتيب — لا يمكن إكمال درس إذا لم يُكمل السابق
  if (!lesson.isPreview && lesson.order > 0) {
    const previousLessons = await Lesson.find({
      course:      new Types.ObjectId(courseId),
      isPublished: true,
      order:       { $lt: lesson.order },
    }).select('_id').lean();

    if (previousLessons.length > 0) {
      const previousIds = previousLessons.map((l) => l._id);
      const completedPrev = await LessonProgress.countDocuments({
        student: new Types.ObjectId(viewer.userId),
        lesson:  { $in: previousIds },
      });

      if (completedPrev < previousLessons.length) {
        return {
          statusCode: 403,
          data: { message: 'أكمل الدروس السابقة أولاً' },
        };
      }
    }
  }

  // upsert — إذا أكمله قبل لا يحدث خطأ
  await LessonProgress.findOneAndUpdate(
    {
      student: new Types.ObjectId(viewer.userId),
      course:  new Types.ObjectId(courseId),
      lesson:  new Types.ObjectId(lessonId),
    },
    { completedAt: new Date() },
    { upsert: true, new: true },
  );

  return { statusCode: 200, data: { message: 'Lesson marked as complete' } };
};
