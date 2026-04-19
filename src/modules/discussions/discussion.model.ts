import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface IDiscussion {
  course: Types.ObjectId;
  lesson?: Types.ObjectId;
  student: Types.ObjectId;
  question: string;
  questionEditedAt?: Date;
  answer?: string;
  answerBy?: Types.ObjectId;
  answerEditedAt?: Date;
  isResolved: boolean;
  deletedAt?: Date | null;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type DiscussionDocument = HydratedDocument<IDiscussion>;

const discussionSchema = new Schema<IDiscussion>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lesson: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: String, required: true, trim: true },
    questionEditedAt: { type: Date },
    answer: { type: String, trim: true },
    answerBy: { type: Schema.Types.ObjectId, ref: 'User' },
    answerEditedAt: { type: Date },
    isResolved: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

discussionSchema.index({ course: 1, createdAt: -1 });
discussionSchema.index({ student: 1, createdAt: -1 });

export const Discussion = model<IDiscussion>('Discussion', discussionSchema);
