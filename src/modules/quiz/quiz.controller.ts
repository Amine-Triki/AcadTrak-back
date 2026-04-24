import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  createQuiz,
  deleteQuiz,
  getQuizzesByCourse,
  submitQuizAttempt,
  updateQuiz,
} from './quiz.service.js';

const getViewerFromRequest = (req: AuthenticatedRequest) => {
  const authUser = req.authUser;
  if (!authUser) {
    return null;
  }

  return {
    userId: authUser.id,
    role: authUser.role,
  };
};

export const submitQuizAttemptController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const quizId = req.params.quizId;
  if (!quizId || typeof quizId !== 'string') {
    return res.status(400).json({ message: 'Quiz id is required' });
  }

  const rawAnswers = req.body?.answers;
  const isValidAnswer = (value: unknown) =>
    Number.isInteger(value) || (Array.isArray(value) && value.every((item) => Number.isInteger(item)));

  if (!Array.isArray(rawAnswers) || !rawAnswers.every(isValidAnswer)) {
    return res.status(400).json({ message: 'answers must be an array of integers or integer arrays' });
  }

  const { statusCode, data } = await submitQuizAttempt(quizId, rawAnswers as Array<number | number[]>, viewer);
  return res.status(statusCode).json(data);
};

export const createQuizController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { statusCode, data } = await createQuiz(req.body, viewer);
  return res.status(statusCode).json(data);
};

export const getCourseQuizzesController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const courseId = req.params.courseId;
  if (!courseId || typeof courseId !== 'string') {
    return res.status(400).json({ message: 'Course id is required' });
  }

  const { statusCode, data } = await getQuizzesByCourse(courseId, viewer);
  return res.status(statusCode).json(data);
};

export const updateQuizController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const quizId = req.params.quizId;
  if (!quizId || typeof quizId !== 'string') {
    return res.status(400).json({ message: 'Quiz id is required' });
  }

  const { statusCode, data } = await updateQuiz(quizId, req.body, viewer);
  return res.status(statusCode).json(data);
};

export const deleteQuizController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const quizId = req.params.quizId;
  if (!quizId || typeof quizId !== 'string') {
    return res.status(400).json({ message: 'Quiz id is required' });
  }

  const { statusCode, data } = await deleteQuiz(quizId, viewer);
  return res.status(statusCode).json(data);
};

export const healthController = (_req: Request, res: Response) => {
  return res.status(200).json({ message: 'Quiz module is running' });
};
