import { Schema, model, Types, type HydratedDocument } from 'mongoose';
import slugify from 'slugify';

export interface ICourseCoupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  amount: number;
  startsAt?: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface ICourse {
  title: string;
  slug: string;
  description: string;
  instructor: Types.ObjectId; //userId
  category: Types.ObjectId;
  status: 'draft' | 'published';
  type: 'free' | 'paid';
  price: number;
  thumbnail?: string;
  // حقول التقييم الذكية
  averageRating: number;
  totalRatingsCount: number;
  ratingsSum: number;
  isHidden: boolean;
  hiddenAt?: Date | null;
  coupon?: ICourseCoupon;
}

export type CourseDocument = HydratedDocument<ICourse>;

export const getCoursePriceWithCoupon = (
  course: Pick<ICourse, 'type' | 'price' | 'coupon'>,
  couponCode?: string,
  now: Date = new Date()
) => {
  if (course.type === 'free') {
    return 0;
  }

  const coupon = course.coupon;
  if (!coupon || !couponCode) {
    return course.price;
  }

  const normalizedInput = couponCode.trim().toUpperCase();
  const normalizedStored = coupon.code.trim().toUpperCase();
  if (normalizedInput !== normalizedStored || !coupon.isActive) {
    return course.price;
  }

  if (coupon.startsAt && now < coupon.startsAt) {
    return course.price;
  }

  if (now > coupon.expiresAt) {
    return course.price;
  }

  if (coupon.discountType === 'percentage') {
    const discounted = course.price - (course.price * coupon.amount) / 100;
    return Math.max(0, Number(discounted.toFixed(2)));
  }

  return Math.max(0, Number((course.price - coupon.amount).toFixed(2)));
};

const courseSchema = new Schema<ICourse>({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  instructor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  type: { type: String, enum: ['free', 'paid'], default: 'free' },
  price: {
    type: Number,
    default: 0
  },
  thumbnail: { type: String },
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatingsCount: { type: Number, default: 0 },
  ratingsSum: { type: Number, default: 0 },
  isHidden: { type: Boolean, default: false },
  hiddenAt: { type: Date, default: null },
  coupon: {
    code: { type: String, trim: true, uppercase: true },
    discountType: { type: String, enum: ['percentage', 'fixed'] },
    amount: { type: Number, min: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true }
  }
}, { timestamps: true });

courseSchema.pre('validate', function(this: CourseDocument) {
  if (this.title) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }

  if (this.type === 'free') {
    this.price = 0;
  }

  if (this.type === 'paid' && this.price <= 0) {
    this.invalidate('price', 'Paid courses must have a price greater than 0.');
  }

  // Only validate coupon if it explicitly exists and has at least one field set
  if (!this.coupon || Object.keys(this.coupon).length === 0) {
    return;
  }

  // Only validate coupon fields if code is provided (indicates coupon was intentionally set)
  if (!this.coupon.code) {
    return;
  }

  this.coupon.code = this.coupon.code.trim().toUpperCase();

  if (!this.coupon.discountType) {
    this.invalidate('coupon.discountType', 'Coupon discountType is required.');
  }

  if (!this.coupon.expiresAt) {
    this.invalidate('coupon.expiresAt', 'Coupon expiresAt is required.');
  }

  if (this.coupon.startsAt && this.coupon.expiresAt && this.coupon.startsAt >= this.coupon.expiresAt) {
    this.invalidate('coupon.startsAt', 'Coupon startsAt must be before expiresAt.');
  }

  if (this.coupon.discountType === 'percentage' && (this.coupon.amount <= 0 || this.coupon.amount > 100)) {
    this.invalidate('coupon.amount', 'Percentage discount must be greater than 0 and less than or equal to 100.');
  }

  if (this.coupon.discountType === 'fixed' && this.coupon.amount <= 0) {
    this.invalidate('coupon.amount', 'Fixed discount must be greater than 0.');
  }
});

export const Course = model<ICourse>('Course', courseSchema);