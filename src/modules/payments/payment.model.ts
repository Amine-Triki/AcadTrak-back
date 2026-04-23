import { Schema, model, Types, type HydratedDocument } from 'mongoose';

export type PaymentProvider =  'konnect';
export type PaymentStatus   = 'pending' | 'success' | 'failed' | 'expired';

export interface IPayment {
  student:    Types.ObjectId;
  course:     Types.ObjectId;
  provider:   PaymentProvider;
  status:     PaymentStatus;
  amountTND:  number;          // بالـ Millimes دائماً
  couponCode?: string;

  // Konnect
  konnectPaymentRef?: string;
  konnectPayUrl?:     string;
  // tracking
  trackingId: string;          // orderId داخلي للربط مع الـ webhook
  createdAt?: Date;
  updatedAt?: Date;
}

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    student:  { type: Schema.Types.ObjectId, ref: 'User',   required: true, index: true },
    course:   { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    provider: { type: String, enum: ['konnect'], required: true },
    status:   { type: String, enum: ['pending', 'success', 'failed', 'expired'], default: 'pending' },
    amountTND: { type: Number, required: true },
    couponCode: { type: String, uppercase: true, trim: true },
    konnectPaymentRef: { type: String, index: true, sparse: true },
    konnectPayUrl:     { type: String },
    trackingId: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const Payment = model<IPayment>('Payment', paymentSchema);
