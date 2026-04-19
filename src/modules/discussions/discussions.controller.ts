import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  answerDiscussionSchema,
  createDiscussionSchema,
  updateDiscussionSchema,
} from './discussion-validation.js';
import * as discussionsService from './discussions.service.js';

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

export const listCourseDiscussionsController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const courseId = req.params.courseId;
  if (!courseId || typeof courseId !== 'string') {
    return res.status(400).json({ message: 'Course id is required' });
  }

  const { statusCode, data } = await discussionsService.listCourseDiscussions(courseId, viewer);
  return res.status(statusCode).json(data);
};

export const createDiscussionController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const payloadResult = createDiscussionSchema.safeParse(req.body);
  if (!payloadResult.success) {
    return res.status(400).json({ message: payloadResult.error.issues[0]?.message || 'Invalid payload' });
  }

  const { statusCode, data } = await discussionsService.createDiscussion(payloadResult.data, viewer);
  return res.status(statusCode).json(data);
};

export const updateDiscussionController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const discussionId = req.params.id;
  if (!discussionId || typeof discussionId !== 'string') {
    return res.status(400).json({ message: 'Discussion id is required' });
  }

  const payloadResult = updateDiscussionSchema.safeParse(req.body);
  if (!payloadResult.success) {
    return res.status(400).json({ message: payloadResult.error.issues[0]?.message || 'Invalid payload' });
  }

  const { statusCode, data } = await discussionsService.updateDiscussionQuestion(discussionId, payloadResult.data, viewer);
  return res.status(statusCode).json(data);
};

export const softDeleteDiscussionController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const discussionId = req.params.id;
  if (!discussionId || typeof discussionId !== 'string') {
    return res.status(400).json({ message: 'Discussion id is required' });
  }

  const { statusCode, data } = await discussionsService.softDeleteDiscussion(discussionId, viewer);
  return res.status(statusCode).json(data);
};

export const answerDiscussionController = async (req: AuthenticatedRequest, res: Response) => {
  const viewer = getViewerFromRequest(req);
  if (!viewer) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const discussionId = req.params.id;
  if (!discussionId || typeof discussionId !== 'string') {
    return res.status(400).json({ message: 'Discussion id is required' });
  }

  const payloadResult = answerDiscussionSchema.safeParse(req.body);
  if (!payloadResult.success) {
    return res.status(400).json({ message: payloadResult.error.issues[0]?.message || 'Invalid payload' });
  }

  const { statusCode, data } = await discussionsService.answerDiscussion(discussionId, payloadResult.data, viewer);
  return res.status(statusCode).json(data);
};

export const healthDiscussionController = (_req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({ message: 'Discussions module is running' });
};
