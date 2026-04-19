import { z } from 'zod';

const objectIdSchema = z
	.string()
	.regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const questionSchema = z.object({
	text: z.string().trim().min(5, 'Question text must be at least 5 characters'),
	options: z.array(z.string().trim().min(1, 'Option cannot be empty')).length(4, 'Each question must have exactly 4 options'),
	correctIndex: z.number().int().min(0, 'correctIndex must be between 0 and 3').max(3, 'correctIndex must be between 0 and 3'),
	explanation: z.string().trim().min(1, 'Explanation cannot be empty').optional(),
});

const quizWriteSchema = z.object({
	title: z.string().trim().min(3, 'Quiz title must be at least 3 characters'),
	type: z.enum(['quiz', 'final_exam']),
	order: z.number().int().min(0, 'Order must be greater than or equal to 0'),
	questions: z.array(questionSchema).min(1, 'Quiz must contain at least one question'),
	passingScore: z.number().int().min(1, 'Passing score must be between 1 and 100').max(100, 'Passing score must be between 1 and 100').default(70),
	isPublished: z.boolean().optional().default(false),
});

export const createQuizSchema = quizWriteSchema.extend({
	course: objectIdSchema,
});

export const updateQuizSchema = z.object({
	title: z.string().trim().min(3, 'Quiz title must be at least 3 characters').optional(),
	type: z.enum(['quiz', 'final_exam']).optional(),
	order: z.number().int().min(0, 'Order must be greater than or equal to 0').optional(),
	questions: z.array(questionSchema).min(1, 'Quiz must contain at least one question').optional(),
	passingScore: z.number().int().min(1, 'Passing score must be between 1 and 100').max(100, 'Passing score must be between 1 and 100').optional(),
	isPublished: z.boolean().optional(),
	course: objectIdSchema.optional(),
}).superRefine((payload, ctx) => {
	if (Object.keys(payload).length === 0) {
		ctx.addIssue({
			code: 'custom',
			message: 'At least one field is required for update',
		});
	}
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
