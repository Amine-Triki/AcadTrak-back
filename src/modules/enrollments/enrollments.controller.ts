import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { enrollInCourse, getCourseEnrollments, getMyEnrollments } from './enrollments.service.js';

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

export const enrollInCourseController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const courseId = req.params.courseId;
  if (!courseId || typeof courseId !== 'string') {
    return res.status(400).json({ message: 'Course id is required' });
  }

  const couponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode : undefined;
  const { statusCode, data } = await enrollInCourse(courseId, viewer, couponCode);
  return res.status(statusCode).json(data);
};

export const myEnrollmentsController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { statusCode, data } = await getMyEnrollments(viewer);
  return res.status(statusCode).json(data);
};

export const courseEnrollmentsController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const courseId = req.params.courseId;
  if (!courseId || typeof courseId !== 'string') {
    return res.status(400).json({ message: 'Course id is required' });
  }

  const { statusCode, data } = await getCourseEnrollments(courseId, viewer);
  return res.status(statusCode).json(data);
};
