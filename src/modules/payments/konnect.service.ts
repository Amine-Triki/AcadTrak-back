import { env } from '../../config/env.js';
import { Course, getCoursePriceWithCoupon } from '../courses/course.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Payment } from './payment.model.js';
import { isValidObjectId } from '../../utils/mongo.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';

// Sandbox vs Production
const KONNECT_BASE = env.NODE_ENV === 'production'
  ? 'https://api.konnect.network/api/v2'
  : 'https://api.sandbox.konnect.network/api/v2';

const USD_TO_TND_RATE = 3.1;
const toMillimes = (usd: number) => Math.round(usd * USD_TO_TND_RATE * 1000);

interface KonnectInitResponse {
  payUrl?:      string;
  paymentRef?:  string;
  message?:     string;
}

interface KonnectVerifyResponse {
  payment?: {
    status?:   string;
    amount?:   number;
    metadata?: Record<string, string>;
  };
}

const konnectHeaders = () => ({
  'Content-Type': 'application/json',
  'x-api-key':    env.KONNECT_API_KEY,
});

export const initKonnectPayment = async (
  courseId:    string,
  viewer:      ViewerContext,
  couponCode?: string,
): Promise<ServiceResult> => {
  if (!isValidObjectId(courseId)) {
    return { statusCode: 400, data: { message: 'Invalid course id' } };
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return { statusCode: 404, data: { message: 'Course not found' } };
  }
  if (course.type === 'free') {
    return { statusCode: 400, data: { message: 'Free courses do not require payment' } };
  }

  const alreadyEnrolled = await Enrollment.findOne({
    student: new Types.ObjectId(viewer.userId),
    course:  course._id,
  }).select('_id');
  if (alreadyEnrolled) {
    return { statusCode: 409, data: { message: 'Already enrolled' } };
  }

  const effectivePriceUSD = getCoursePriceWithCoupon(course, couponCode);

  if (effectivePriceUSD === 0) {
    const enrollment = await Enrollment.create({
      student:         new Types.ObjectId(viewer.userId),
      course:          course._id,
      paidPrice:       0,
      couponCode:      couponCode?.trim().toUpperCase(),
      paymentProvider: 'coupon_100',
    });
    return {
      statusCode: 201,
      data: { message: 'Enrolled for free with 100% coupon', enrollmentId: String(enrollment._id) },
    };
  }

  const amountMillimes = toMillimes(effectivePriceUSD);
  const trackingId     = randomUUID();

  const payment = await Payment.create({
    student:   new Types.ObjectId(viewer.userId),
    course:    course._id,
    provider:  'konnect',
    status:    'pending',
    amountTND: amountMillimes,
    couponCode: couponCode?.trim().toUpperCase(),
    trackingId,
  });

  const body = {
    receiverWalletId:         env.KONNECT_WALLET_ID,
    token:                    'TND',
    amount:                   amountMillimes,
    type:                     'immediate',
    description:              `AcadTrak: ${course.title}`,
    acceptedPaymentMethods:   ['wallet', 'bank_card', 'e-DINAR'],
    lifespan:                 30,
    checkoutForm:             false,
    addPaymentFeesToAmount:   true,
    orderId:                  trackingId,
    webhook:                  `${env.BACKEND_URL}/api/payments/konnect/webhook`,
    theme:                    'light',
  };

  try {
    const res  = await fetch(`${KONNECT_BASE}/payments/init-payment`, {
      method:  'POST',
      headers: konnectHeaders(),
      body:    JSON.stringify(body),
    });
    const data = await res.json() as KonnectInitResponse;

    if (!res.ok || !data.payUrl) {
      await Payment.findByIdAndDelete(payment._id);
      return { statusCode: 400, data: { message: data.message || 'Konnect payment initialization failed' } };
    }

    payment.konnectPaymentRef = data.paymentRef;
    payment.konnectPayUrl     = data.payUrl;
    await payment.save();

    return {
      statusCode: 200,
      data: {
        paymentRef: data.paymentRef,
        paymentUrl: data.payUrl,
        provider:   'konnect',
        amountTND:  amountMillimes / 1000,
      },
    };
  } catch {
    await Payment.findByIdAndDelete(payment._id);
    return { statusCode: 500, data: { message: 'Failed to connect to Konnect' } };
  }
};

export const handleKonnectWebhook = async (
  paymentRef: string,
): Promise<ServiceResult> => {
  if (!paymentRef) {
    return { statusCode: 400, data: { message: 'paymentRef is required' } };
  }

  const res  = await fetch(`${KONNECT_BASE}/payments/${paymentRef}`, {
    headers: konnectHeaders(),
  });
  const data = await res.json() as KonnectVerifyResponse;

  const payment = await Payment.findOne({ konnectPaymentRef: paymentRef });
  if (!payment) {
    return { statusCode: 404, data: { message: 'Payment record not found' } };
  }

  if (data.payment?.status === 'completed') {
    payment.status = 'success';
    await payment.save();

    const exists = await Enrollment.findOne({
      student: payment.student,
      course:  payment.course,
    }).select('_id');

    if (!exists) {
      await Enrollment.create({
        student:           payment.student,
        course:            payment.course,
        paidPrice:         payment.amountTND / 1000,
        couponCode:        payment.couponCode,
        paymentProvider:   'konnect',
        konnectPaymentRef: paymentRef,
      });
    }
    return { statusCode: 200, data: { enrolled: true } };
  }

  return { statusCode: 200, data: { enrolled: false } };
};
