import { env } from '../../config/env.js';
import { Course, getCoursePriceWithCoupon } from '../courses/course.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Payment } from './payment.model.js';
import { isValidObjectId } from '../../utils/mongo.js';
import type { ServiceResult, ViewerContext } from '../../types/index.js';
import { Types } from 'mongoose';
import { randomUUID } from 'crypto';

const FLOUCI_API = 'https://developers.flouci.com/api/v2';

// ─── USD → TND تقريبي (للإنتاج استخدم API سعر صرف حقيقي) ────────────────
const USD_TO_TND_RATE = 3.1;
const toMillimes = (usd: number) => Math.round(usd * USD_TO_TND_RATE * 1000);

interface FlouciGenerateResponse {
  result?: { success: boolean; payment_id: string; link: string };
  code?: number;
}

interface FlouciVerifyResponse {
  success?: boolean;
  result?: {
    status: 'SUCCESS' | 'PENDING' | 'EXPIRED' | 'FAILURE';
    amount: number;
    developer_tracking_id: string;
    details?: { name?: string };
  };
}

const flouciHeaders = () => ({
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${env.FLOUCI_PUBLIC_KEY}:${env.FLOUCI_PRIVATE_KEY}`,
});

// ── 1. إنشاء جلسة دفع Flouci ─────────────────────────────────────────────
export const initFlouciPayment = async (
  courseId: string,
  viewer:   ViewerContext,
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

  // تحقق من التسجيل المسبق
  const alreadyEnrolled = await Enrollment.findOne({
    student: new Types.ObjectId(viewer.userId),
    course:  course._id,
  }).select('_id');
  if (alreadyEnrolled) {
    return { statusCode: 409, data: { message: 'Already enrolled in this course' } };
  }

  const effectivePriceUSD = getCoursePriceWithCoupon(course, couponCode);

  // كوبون 100% → تسجيل مجاني فوري
  if (effectivePriceUSD === 0) {
    const enrollment = await Enrollment.create({
      student:      new Types.ObjectId(viewer.userId),
      course:       course._id,
      paidPrice:    0,
      couponCode:   couponCode?.trim().toUpperCase(),
      paymentProvider: 'coupon_100',
    });
    return {
      statusCode: 201,
      data: { message: 'Enrolled for free with 100% coupon', enrollmentId: String(enrollment._id) },
    };
  }

  const amountMillimes = toMillimes(effectivePriceUSD);
  const trackingId     = randomUUID();

  // إنشاء payment record بحالة pending
  const payment = await Payment.create({
    student:    new Types.ObjectId(viewer.userId),
    course:     course._id,
    provider:   'flouci',
    status:     'pending',
    amountTND:  amountMillimes,
    couponCode: couponCode?.trim().toUpperCase(),
    trackingId,
  });

  // استدعاء Flouci API
  const body = {
    amount:                  String(amountMillimes),
    developer_tracking_id:   trackingId,
    accept_card:             true,
    success_link:            `${env.FRONTEND_URL}/dashboard/student/courses?payment=success&provider=flouci`,
    fail_link:               `${env.FRONTEND_URL}/courses?payment=failed&provider=flouci`,
    webhook:                 `${env.BACKEND_URL}/api/payments/flouci/webhook`,
    client_id:               viewer.userId,
  };

  try {
    const res  = await fetch(`${FLOUCI_API}/generate_payment`, {
      method:  'POST',
      headers: flouciHeaders(),
      body:    JSON.stringify(body),
    });
    const data = await res.json() as FlouciGenerateResponse;

    if (!res.ok || !data.result?.success) {
      await Payment.findByIdAndDelete(payment._id);
      return { statusCode: 400, data: { message: 'Flouci payment initialization failed' } };
    }

    // حفظ payment_id وlink
    payment.flouciPaymentId = data.result.payment_id;
    payment.flouciLink      = data.result.link;
    await payment.save();

    return {
      statusCode: 200,
      data: {
        paymentId:  data.result.payment_id,
        paymentUrl: data.result.link,
        provider:   'flouci',
        amountTND:  amountMillimes / 1000, // بالدينار للعرض
      },
    };
  } catch {
    await Payment.findByIdAndDelete(payment._id);
    return { statusCode: 500, data: { message: 'Failed to connect to Flouci' } };
  }
};

// ── 2. Webhook من Flouci ─────────────────────────────────────────────────
export const handleFlouciWebhook = async (
  paymentId: string,
): Promise<ServiceResult> => {
  if (!paymentId) {
    return { statusCode: 400, data: { message: 'payment_id is required' } };
  }

  // تحقق من حالة الدفع مع Flouci
  const res  = await fetch(`${FLOUCI_API}/verify_payment/${paymentId}`, {
    headers: flouciHeaders(),
  });
  const data = await res.json() as FlouciVerifyResponse;

  if (!res.ok || !data.success) {
    return { statusCode: 400, data: { message: 'Failed to verify payment' } };
  }

  const status = data.result?.status;

  // تحديث الـ payment record
  const payment = await Payment.findOne({ flouciPaymentId: paymentId });
  if (!payment) {
    return { statusCode: 404, data: { message: 'Payment record not found' } };
  }

  if (status === 'SUCCESS') {
    payment.status = 'success';
    await payment.save();

    // تسجيل الطالب إذا لم يكن مسجلاً
    const existing = await Enrollment.findOne({
      student: payment.student,
      course:  payment.course,
    }).select('_id');

    if (!existing) {
      await Enrollment.create({
        student:         payment.student,
        course:          payment.course,
        paidPrice:       payment.amountTND / 1000,
        couponCode:      payment.couponCode,
        paymentProvider: 'flouci',
        flouciPaymentId: paymentId,
      });
    }

    return { statusCode: 200, data: { enrolled: true } };
  }

  if (status === 'FAILURE' || status === 'EXPIRED') {
    payment.status = status === 'EXPIRED' ? 'expired' : 'failed';
    await payment.save();
  }

  return { statusCode: 200, data: { enrolled: false, status } };
};

// ── 3. التحقق اليدوي (يُستدعى من Frontend بعد redirect) ─────────────────
export const verifyFlouciPayment = async (
  paymentId: string,
  viewer:    ViewerContext,
): Promise<ServiceResult> => {
  const payment = await Payment.findOne({
    flouciPaymentId: paymentId,
    student:         new Types.ObjectId(viewer.userId),
  });

  if (!payment) {
    return { statusCode: 404, data: { message: 'Payment not found' } };
  }

  // إذا سبق معالجته من الـ webhook
  if (payment.status === 'success') {
    const enrollment = await Enrollment.findOne({
      student: payment.student,
      course:  payment.course,
    }).select('_id');
    return {
      statusCode: 200,
      data: { status: 'success', enrolled: Boolean(enrollment) },
    };
  }

  // تحقق مباشر من Flouci
  const res  = await fetch(`${FLOUCI_API}/verify_payment/${paymentId}`, {
    headers: flouciHeaders(),
  });
  const data = await res.json() as FlouciVerifyResponse;

  if (!res.ok || !data.success) {
    return { statusCode: 400, data: { message: 'Verification failed' } };
  }

  const flouciStatus = data.result?.status ?? 'PENDING';

  if (flouciStatus === 'SUCCESS' && payment.status !== 'success') {
    payment.status = 'success';
    await payment.save();

    const exists = await Enrollment.findOne({
      student: payment.student,
      course:  payment.course,
    }).select('_id');

    if (!exists) {
      await Enrollment.create({
        student:         payment.student,
        course:          payment.course,
        paidPrice:       payment.amountTND / 1000,
        couponCode:      payment.couponCode,
        paymentProvider: 'flouci',
        flouciPaymentId: paymentId,
      });
    }
  }

  return {
    statusCode: 200,
    data: { status: flouciStatus.toLowerCase(), enrolled: flouciStatus === 'SUCCESS' },
  };
};
