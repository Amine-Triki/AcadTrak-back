import { z } from 'zod';

const objectIdSchema = z
	.string()
	.regex(/^[a-fA-F0-9]{24}$/, 'Invalid id format');

const questionSchema = z.object({
	text: z.string().trim().min(5, 'Question text must be at least 5 characters'),
	options: z.array(z.string().trim().min(1, 'Option cannot be empty')).min(2, 'Each question must have at least 2 options'),
	correctIndex: z.number().int().min(0).optional(),
	correctIndices: z.array(z.number().int().min(0)).min(1).optional(),
	explanation: z.string().trim().min(1, 'Explanation cannot be empty').optional(),
}).superRefine((question, ctx) => {
	if (!question.correctIndices && question.correctIndex === undefined) {
		ctx.addIssue({
			code: 'custom',
			message: 'Each question must have at least one correct answer',
			path: ['correctIndices'],
		});
	}

	if (question.correctIndices && question.correctIndices.length === 0) {
		ctx.addIssue({
			code: 'custom',
			message: 'Each question must have at least one correct answer',
			path: ['correctIndices'],
		});
	}

	if (question.correctIndex !== undefined && question.correctIndex < 0) {
		ctx.addIssue({
			code: 'custom',
			message: 'correctIndex must be greater than or equal to 0',
			path: ['correctIndex'],
		});
	}

	const maxIndex = question.options.length - 1;
	const correctIndices = question.correctIndices ?? (question.correctIndex !== undefined ? [question.correctIndex] : []);

	for (const correctIndex of correctIndices) {
		if (correctIndex > maxIndex) {
			ctx.addIssue({
				code: 'custom',
				message: `Correct answer index must be between 0 and ${maxIndex}`,
				path: ['correctIndices'],
			});
			break;
		}
	}
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
