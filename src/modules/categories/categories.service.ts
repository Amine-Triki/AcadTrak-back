import { Category } from './category.model.js';
import type { ServiceResult } from '../../types/index.js';
import { Course } from '../courses/course.model.js';
import { isValidObjectId } from '../../utils/mongo.js';
import slugify from 'slugify';

export const getAllCategories = async (): Promise<ServiceResult> => {
  const categories = await Category.find()
    .select('_id name slug')
    .sort({ name: 1 });

  return {
    statusCode: 200,
    data: {
      categories: categories.map((category) => ({
        id: String(category._id),
        name: category.name,
        slug: category.slug,
      })),
      total: categories.length,
    },
  };
};

export const createCategory = async (name: string): Promise<ServiceResult> => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return { statusCode: 400, data: { message: 'Category name is required' } };
  }

  const slug = slugify(normalizedName, { lower: true, strict: true });
  if (!slug) {
    return { statusCode: 400, data: { message: 'Invalid category name' } };
  }

  const existing = await Category.findOne({ $or: [{ name: normalizedName }, { slug }] }).select('_id');
  if (existing) {
    return { statusCode: 409, data: { message: 'Category already exists' } };
  }

  const created = await Category.create({ name: normalizedName, slug });

  return {
    statusCode: 201,
    data: {
      message: 'Category created successfully',
      category: {
        id: String(created._id),
        name: created.name,
        slug: created.slug,
      },
    },
  };
};

export const updateCategory = async (categoryId: string, name: string): Promise<ServiceResult> => {
  if (!isValidObjectId(categoryId)) {
    return { statusCode: 400, data: { message: 'Invalid category id' } };
  }

  const normalizedName = name.trim();
  if (!normalizedName) {
    return { statusCode: 400, data: { message: 'Category name is required' } };
  }

  const slug = slugify(normalizedName, { lower: true, strict: true });
  if (!slug) {
    return { statusCode: 400, data: { message: 'Invalid category name' } };
  }

  const duplicate = await Category.findOne({
    _id: { $ne: categoryId },
    $or: [{ name: normalizedName }, { slug }],
  }).select('_id');

  if (duplicate) {
    return { statusCode: 409, data: { message: 'Category already exists' } };
  }

  const updated = await Category.findByIdAndUpdate(
    categoryId,
    { name: normalizedName, slug },
    { new: true },
  );

  if (!updated) {
    return { statusCode: 404, data: { message: 'Category not found' } };
  }

  return {
    statusCode: 200,
    data: {
      message: 'Category updated successfully',
      category: {
        id: String(updated._id),
        name: updated.name,
        slug: updated.slug,
      },
    },
  };
};

export const deleteCategory = async (categoryId: string): Promise<ServiceResult> => {
  if (!isValidObjectId(categoryId)) {
    return { statusCode: 400, data: { message: 'Invalid category id' } };
  }

  const usageCount = await Course.countDocuments({ category: categoryId });
  if (usageCount > 0) {
    return {
      statusCode: 409,
      data: { message: 'Cannot delete category because it is used by existing courses' },
    };
  }

  const deleted = await Category.findByIdAndDelete(categoryId);
  if (!deleted) {
    return { statusCode: 404, data: { message: 'Category not found' } };
  }

  return {
    statusCode: 200,
    data: { message: 'Category deleted successfully' },
  };
};
