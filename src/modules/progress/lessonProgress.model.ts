import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface ILessonProgress {
  student:     Types.ObjectId;
  course:      Types.ObjectId;
  lesson:      Types.ObjectId;
  completedAt: Date;
}

export type LessonProgressDocument = HydratedDocument<ILessonProgress>;

const lessonProgressSchema = new Schema<ILessonProgress>(
  {
    student:     { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    course:      { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    lesson:      { type: Schema.Types.ObjectId, ref: 'Lesson', required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// ✅ طالب واحد لا يُكمل نفس الدرس مرتين
lessonProgressSchema.index({ student: 1, lesson: 1 }, { unique: true });
lessonProgressSchema.index({ student: 1, course: 1 });

export const LessonProgress = model<ILessonProgress>('LessonProgress', lessonProgressSchema);
