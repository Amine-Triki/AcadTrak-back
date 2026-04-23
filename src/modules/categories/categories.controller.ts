import type { Request, Response } from 'express';
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  updateCategory,
} from './categories.service.js';

export const getAllCategoriesController = async (_req: Request, res: Response) => {
  const { statusCode, data } = await getAllCategories();
  return res.status(statusCode).json(data);
};

export const createCategoryController = async (req: Request, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name : '';
  const { statusCode, data } = await createCategory(name);
  return res.status(statusCode).json(data);
};

export const updateCategoryController = async (req: Request, res: Response) => {
  const categoryId = req.params.id;
  if (!categoryId || typeof categoryId !== 'string') {
    return res.status(400).json({ message: 'Category id is required' });
  }
  const name = typeof req.body?.name === 'string' ? req.body.name : '';
  const { statusCode, data } = await updateCategory(categoryId, name);
  return res.status(statusCode).json(data);
};

export const deleteCategoryController = async (req: Request, res: Response) => {
  const categoryId = req.params.id;
  if (!categoryId || typeof categoryId !== 'string') {
    return res.status(400).json({ message: 'Category id is required' });
  }
  const { statusCode, data } = await deleteCategory(categoryId);
  return res.status(statusCode).json(data);
};
