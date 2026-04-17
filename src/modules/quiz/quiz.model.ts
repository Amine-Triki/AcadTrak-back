import { Schema, model, Types, type HydratedDocument } from 'mongoose';

// ── سؤال واحد ──────────────────────────────────
export interface IQuestion {
  text:          string;
  options:       string[];     // 4 خيارات
  correctIndex:  number;       // رقم الخيار الصحيح (0-3)
  explanation?:  string;       // شرح الإجابة الصحيحة
}

export type QuizType = 'quiz' | 'final_exam';

export interface IQuiz {
  course:          Types.ObjectId;
  title:           string;
  type:            QuizType;
  // ترتيب الـ Quiz داخل الكورس (بعد lesson order X)
  order:           number;
  questions:       IQuestion[];
  passingScore:    number;   // نسبة النجاح (مثلاً 70 = 70%)
  isPublished:     boolean;
}

export type QuizDocument = HydratedDocument<IQuiz>;

const questionSchema = new Schema<IQuestion>(
  {
    text:         { type: String, required: true },
    options:      { type: [String], required: true,
                    validate: [(v: string[]) => v.length === 4,
                               'Must have exactly 4 options'] },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation:  { type: String },
  },
  { _id: false },
);

const quizSchema = new Schema<IQuiz>(
  {
    course:       { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title:        { type: String, required: true },
    type:         { type: String, enum: ['quiz', 'final_exam'], default: 'quiz' },
    order:        { type: Number, required: true },   // ترتيبه بين الدروس
    questions:    { type: [questionSchema], required: true,
                    validate: [(v: IQuestion[]) => v.length >= 1,
                               'Quiz must have at least 1 question'] },
    passingScore: { type: Number, default: 70, min: 1, max: 100 },
    isPublished:  { type: Boolean, default: false },
  },
  { timestamps: true },
);

quizSchema.index({ course: 1, order: 1 });

// ✅ كل كورس له final_exam واحد فقط
quizSchema.index(
  { course: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'final_exam' } },
);

export const Quiz = model<IQuiz>('Quiz', quizSchema);