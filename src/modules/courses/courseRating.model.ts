import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface ICourseRating {
  course: Types.ObjectId;
  student: Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CourseRatingDocument = HydratedDocument<ICourseRating>;

const courseRatingSchema = new Schema<ICourseRating>(
  {
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

courseRatingSchema.index({ course: 1, student: 1 }, { unique: true });

export const CourseRating = model<ICourseRating>('CourseRating', courseRatingSchema);
