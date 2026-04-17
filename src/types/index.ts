export type UserRole = 'student' | 'teacher' | 'admin';

export interface ViewerContext {
	userId: string;
	role: UserRole;
}

export interface ServiceResult {
	statusCode: number;
	data: unknown;
}