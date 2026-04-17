import { isValidObjectId } from '../../utils/mongo.js';
import { Quiz } from './quiz.model.js';
import { QuizAttempt } from './quizAttempt.model.js';
import { Certificate } from './certificate.model.js';
import type { ViewerContext } from '../../types/index.js';

export const submitQuizAttempt = async (
  quizId: string,
  studentAnswers: number[],    // [0, 2, 1, 3, ...] — index الإجابة لكل سؤال
  viewer: ViewerContext,
) => {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) return { statusCode: 404, data: { message: 'Quiz not found' } };

  // حساب النتيجة
  const answers = quiz.questions.map((q, i) => ({
    questionIndex: i,
    chosenIndex:   studentAnswers[i] ?? -1,
    isCorrect:     studentAnswers[i] === q.correctIndex,
  }));

  const correct = answers.filter(a => a.isCorrect).length;
  const score   = Math.round((correct / quiz.questions.length) * 100);
  const passed  = score >= quiz.passingScore;

  // حفظ المحاولة
  await QuizAttempt.create({
    student: viewer.userId,
    quiz:    quiz._id,
    course:  quiz.course,
    answers, score, passed,
  });

  // ✅ إذا اجتاز الـ final_exam → أصدر شهادة تلقائياً
  if (passed && quiz.type === 'final_exam') {
    const alreadyHas = await Certificate.findOne({
      student: viewer.userId,
      course:  quiz.course,
    });

    if (!alreadyHas) {
      await Certificate.create({
        student:   viewer.userId,
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
        correctIndex: quiz.questions[i]?.correctIndex,
        explanation:  quiz.questions[i]?.explanation,
      })),
      ...(passed && quiz.type === 'final_exam' && {
        certificateIssued: true,
        message: '🎓 تهانينا! حصلت على شهادتك'
      }),
    },
  };
};