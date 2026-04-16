import userModel from "./user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { registerSchema, loginSchema } from "./user-validation.js";
import { ZodError } from "zod";
import { env } from "../../config/env.js";

interface RegisterParams {
  firstName: string;
  lastName: string;
  userName: string;
  country: string;
  email: string;
  password: string;
}

export const register = async ({
  firstName,
  lastName,
  userName,
  country,
  email,
  password,
}: RegisterParams) => {
  try {
    // Validate input with Zod
    const validatedData = registerSchema.parse({
      firstName,
      lastName,
      userName,
      country,
      email,
      password,
    });

    const findUser = await userModel.findOne({ email, deletedAt: null });
    if (findUser) {
      return { data: "User already exists", statusCode: 400 };
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    const newUser = new userModel({
      email: validatedData.email,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      userName: validatedData.userName,
      country: validatedData.country,
      role: "student",
      password: hashedPassword,
    });
    await newUser.save();

    return {
      data: generateJWT({
        id: String(newUser._id),
        email: newUser.email,
        role: newUser.role,
      }),
      statusCode: 200,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        data: error.issues[0]?.message || "Validation error",
        statusCode: 400
      };
    }
    return {
      data: (error as any)?.message || "Unknown error",
      statusCode: 400
    };
  }
};

interface LoginParams {
  email: string;
  password: string;
}
export const login = async ({ email, password }: LoginParams) => {
  try {
    // Validate input with Zod
    const validatedData = loginSchema.parse({ email, password });

    const findUser = await userModel.findOne({
      email: validatedData.email,
      deletedAt: null
    });

    if (!findUser) {
      return { data: " Incorrect email or password !", statusCode: 400 };
    }

    const passwordMatch = await bcrypt.compare(validatedData.password, findUser.password);
    if (passwordMatch) {
      return {
        data: generateJWT({
          id: String(findUser._id),
          email: findUser.email,
          role: findUser.role,
        }),
        statusCode: 200,
      };
    }

    return { data: " Incorrect email or password !", statusCode: 400 };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        data: error.issues[0]?.message || "Validation error",
        statusCode: 400
      };
    }
    return {
      data: (error as any)?.message || "Unknown error",
      statusCode: 400
    };
  }
}   


// Soft delete user
export const softDeleteUser = async (userId: string) => {
  try {
    const user = await userModel.findByIdAndUpdate(
      userId,
      { deletedAt: new Date() },
      { new: true }
    );

    if (!user) {
      return { data: "User not found", statusCode: 404 };
    }

    return { data: "User deleted successfully", statusCode: 200 };
  } catch (error: any) {
    return { data: error.message, statusCode: 500 };
  }
};

// Restore soft deleted user
export const restoreUser = async (userId: string) => {
  try {
    const user = await userModel.findByIdAndUpdate(
      userId,
      { deletedAt: null },
      { new: true }
    );

    if (!user) {
      return { data: "User not found", statusCode: 404 };
    }

    return { data: "User restored successfully", statusCode: 200 };
  }catch (error: any) {
    return { data: error.message, statusCode: 500 };
  }
};

const generateJWT = (data: { id: string; email: string; role: string }) => {
  const expiresIn = (env.JWT_EXPIRES_IN || "7d") as NonNullable<
    SignOptions["expiresIn"]
  >;
  return jwt.sign(data, env.JWT_SECRET, {
    expiresIn,
  });
};
