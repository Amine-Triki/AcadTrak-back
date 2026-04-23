import express from 'express';
import {
	createCategoryController,
	deleteCategoryController,
	getAllCategoriesController,
	updateCategoryController,
} from './categories.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { authorize } from '../../middleware/authorize.js';

const router = express.Router();

router.get('/', getAllCategoriesController);
router.post('/', requireAuth, authorize('admin'), createCategoryController);
router.patch('/:id', requireAuth, authorize('admin'), updateCategoryController);
router.delete('/:id', requireAuth, authorize('admin'), deleteCategoryController);

export default router;
