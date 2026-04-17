import { Schema, model, Types } from 'mongoose';
import { randomUUID } from 'crypto';

const certificateSchema = new Schema(
  {
    student:       { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    course:        { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    finalExam:     { type: Schema.Types.ObjectId, ref: 'Quiz',   required: true },
    score:         { type: Number, required: true },
    certificateId: { type: String, unique: true,
                     default: () => randomUUID() },  // رقم فريد للتحقق
    issuedAt:      { type: Date, default: Date.now },
  },
  { timestamps: true },
);

certificateSchema.index({ student: 1, course: 1 }, { unique: true });

export const Certificate = model('Certificate', certificateSchema);