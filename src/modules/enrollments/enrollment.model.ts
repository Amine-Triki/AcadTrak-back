import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export interface IEnrollment {
  student:    Types.ObjectId;
  course:     Types.ObjectId;
  paidPrice:  number;
  couponCode?: string;
  enrolledAt: Date;
  // مزود الدفع
  paymentProvider?: 'flouci' | 'konnect' | 'coupon_100' | 'free';
  flouciPaymentId?: string;
  konnectPaymentRef?: string;
}

export type EnrollmentDocument = HydratedDocument<IEnrollment>;

const enrollmentSchema = new Schema<IEnrollment>({
  student:    { type: Schema.Types.ObjectId, ref: 'User',   required: true, index: true },
  course:     { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  paidPrice:  { type: Number, required: true, min: 0 },
  couponCode: { type: String, trim: true, uppercase: true },
  enrolledAt: { type: Date, default: Date.now },
  paymentProvider: {
    type: String,
    enum: ['flouci', 'konnect', 'coupon_100', 'free'],
  },
  flouciPaymentId:   { type: String, sparse: true },
  konnectPaymentRef: { type: String, sparse: true },
}, { timestamps: true });

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

export const Enrollment = model<IEnrollment>('Enrollment', enrollmentSchema);
