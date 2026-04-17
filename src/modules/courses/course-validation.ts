import { z } from 'zod';

const objectIdSchema = z
	.string()
	.regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const couponSchema = z.object({
	code: z.string().trim().min(1, 'Coupon code is required'),
	discountType: z.enum(['percentage', 'fixed']),
	amount: z.number().positive('Coupon amount must be greater than 0'),
	startsAt: z.coerce.date().optional(),
	expiresAt: z.coerce.date(),
	isActive: z.boolean().optional().default(true),
}).refine((coupon) => {
	if (!coupon.startsAt) {
		return true;
	}

	return coupon.startsAt < coupon.expiresAt;
}, {
	message: 'Coupon startsAt must be before expiresAt',
	path: ['startsAt'],
});

export const courseSchema = z.object({
	title: z.string().trim().min(3, 'Title must be at least 3 characters'),
	description: z.string().trim().min(10, 'Description must be at least 10 characters'),
	category: objectIdSchema,
	status: z.enum(['draft', 'published']).optional(),
	type: z.enum(['free', 'paid']),
	price: z.number().min(0, 'Price cannot be negative').optional(),
	thumbnail: z.string().trim().url('Thumbnail must be a valid URL').optional(),
	coupon: couponSchema.optional(),
}).refine((course) => {
	if (course.type === 'free') {
		return true;
	}

	return typeof course.price === 'number' && course.price > 0;
}, {
	message: 'Paid course must have a price greater than 0',
	path: ['price'],
});

const updateCourseBaseSchema = z.object({
	title: z.string().trim().min(3, 'Title must be at least 3 characters').optional(),
	description: z.string().trim().min(10, 'Description must be at least 10 characters').optional(),
	category: objectIdSchema.optional(),
	status: z.enum(['draft', 'published']).optional(),
	type: z.enum(['free', 'paid']).optional(),
	price: z.number().min(0, 'Price cannot be negative').optional(),
	thumbnail: z.string().trim().url('Thumbnail must be a valid URL').optional(),
	coupon: couponSchema.optional(),
});

export const updateCourseSchema = updateCourseBaseSchema.superRefine((course, ctx) => {
	if (course.type === 'paid' && typeof course.price === 'number' && course.price <= 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Paid course must have a price greater than 0',
			path: ['price'],
		});
	}
});

export type CreateCourseInput = z.infer<typeof courseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
