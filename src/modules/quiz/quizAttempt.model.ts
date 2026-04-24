import { Schema, model, Types, type HydratedDocument } from 'mongoose';

interface IAnswerRecord {
  questionIndex:  number;
  chosenIndices:  number[];
  isCorrect:      boolean;
}

export interface IQuizAttempt {
  student:   Types.ObjectId;
  quiz:      Types.ObjectId;
  course:    Types.ObjectId;
  answers:   IAnswerRecord[];
  score:     number;    // نسبة مئوية 0-100
  passed:    boolean;
  takenAt:   Date;
}

export type QuizAttemptDocument = HydratedDocument<IQuizAttempt>;

const quizAttemptSchema = new Schema<IQuizAttempt>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    quiz:    { type: Schema.Types.ObjectId, ref: 'Quiz',   required: true },
    course:  { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    answers: [{
      questionIndex: { type: Number, required: true },
      chosenIndices: { type: [Number], required: true },
      isCorrect:     { type: Boolean, required: true },
      _id: false,
    }],
    score:   { type: Number, required: true, min: 0, max: 100 },
    passed:  { type: Boolean, required: true },
    takenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

quizAttemptSchema.index({ student: 1, quiz: 1 });

export const QuizAttempt = model<IQuizAttempt>('QuizAttempt', quizAttemptSchema);