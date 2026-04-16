import { Schema, model, Document } from 'mongoose';

interface ICategory extends Document {
  name: string;
  slug: string; // حتى الفئة لها رابط خاص مثل /category/programming
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true }
});

export const Category = model<ICategory>('Category', categorySchema);