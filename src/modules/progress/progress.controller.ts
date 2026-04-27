import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { getCourseProgress, markLessonComplete } from './progress.service.js';

const getViewer = (req: AuthenticatedRequest) => {
  const u = req.authUser;
  if (!u) return null;
  return { userId: u.id, role: u.role as 'student' | 'teacher' | 'admin' };
};

export const getCourseProgressController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewer(req);
  if (!viewer) return res.status(401).json({ message: 'Unauthorized' });
  const { statusCode, data } = await getCourseProgress(req.params.courseId as string, viewer);
  return res.status(statusCode).json(data);
};

export const markLessonCompleteController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewer(req);
  if (!viewer) return res.status(401).json({ message: 'Unauthorized' });
  const { statusCode, data } = await markLessonComplete(
    req.params.courseId as string,
    req.params.lessonId as string,
    viewer,
  );
  return res.status(statusCode).json(data);
};
