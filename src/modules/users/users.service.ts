import userModel from "./user.model.js";
import bcrypt from "bcrypt";
import { registerSchema, loginSchema } from "./user-validation.js";
import { ZodError } from "zod";
import { signAuthToken } from "../../utils/jwt.js";

type UserRole = "student" | "teacher" | "admin";

interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  country: string;
  email: string;
  role: UserRole;
}

interface AuthSuccessData {
  token: string;
  user: UserResponse;
}

const toUserResponse = (user: {
  _id: unknown;
  firstName: string;
  lastName: string;
  userName: string;
  country: string;
  email: string;
  role: UserRole;
}): UserResponse => ({
  id: String(user._id),
  firstName: user.firstName,
  lastName: user.lastName,
  userName: user.userName,
  country: user.country,
  email: user.email,
  role: user.role,
});

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
      return { data: { message: "User already exists" }, statusCode: 400 };
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

    const user = toUserResponse(newUser);
    const token = signAuthToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      data: {
        token,
        user,
      } satisfies AuthSuccessData,
      statusCode: 201,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        data: { message: error.issues[0]?.message || "Validation error" },
        statusCode: 400
      };
    }
    return {
      data: { message: (error as any)?.message || "Unknown error" },
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
      return { data: { message: "Incorrect email or password" }, statusCode: 400 };
    }

    const passwordMatch = await bcrypt.compare(validatedData.password, findUser.password);
    if (passwordMatch) {
      const user = toUserResponse(findUser);
      const token = signAuthToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        data: {
          token,
          user,
        } satisfies AuthSuccessData,
        statusCode: 200,
      };
    }

    return { data: { message: "Incorrect email or password" }, statusCode: 400 };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        data: { message: error.issues[0]?.message || "Validation error" },
        statusCode: 400
      };
    }
    return {
      data: { message: (error as any)?.message || "Unknown error" },
      statusCode: 400
    };
  }
}   

export const getCurrentUser = async (userId: string) => {
  try {
    const user = await userModel
      .findOne({ _id: userId, deletedAt: null })
      .select("_id firstName lastName userName country email role");

    if (!user) {
      return { data: { message: "User not found" }, statusCode: 404 };
    }

    return {
      data: { user: toUserResponse(user) },
      statusCode: 200,
    };
  } catch {
    return { data: { message: "Invalid user id" }, statusCode: 400 };
  }
};


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

