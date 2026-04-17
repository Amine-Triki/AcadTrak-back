import { Types } from 'mongoose';

export const isValidObjectId = (value: string) => Types.ObjectId.isValid(value);