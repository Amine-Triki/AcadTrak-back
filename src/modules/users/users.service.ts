import userModel from "./user.model.js";
import bcrypt from "bcrypt";
import { registerSchema, loginSchema } from "./user-validation.js";
import { ZodError } from "zod";
import { signAuthToken } from "../../utils/jwt.js";
import { Types } from "mongoose";
import { Course } from "../courses/course.model.js";
import { Enrollment } from "../enrollments/enrollment.model.js";
import { Quiz } from "../quiz/quiz.model.js";
import { QuizAttempt } from "../quiz/quizAttempt.model.js";
import { Certificate } from "../quiz/certificate.model.js";
import { Payment } from "../payments/payment.model.js";

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
  identifier: string;
  password: string;
}
export const login = async ({ identifier, password }: LoginParams) => {
  try {
    // Validate input with Zod
    const validatedData = loginSchema.parse({ identifier, password });
    const normalizedIdentifier = validatedData.identifier.trim();

    const findUser = await userModel.findOne({
      $or: [
        { email: normalizedIdentifier },
        { userName: normalizedIdentifier },
      ],
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

export const upgradeToTeacher = async (userId: string) => {
  try {
    const user = await userModel.findOne({ _id: userId, deletedAt: null });

    if (!user) {
      return { data: { message: "User not found" }, statusCode: 404 };
    }

    if (user.role === "admin") {
      return { data: { message: "Admin account cannot be upgraded" }, statusCode: 400 };
    }

    if (user.role === "student") {
      user.role = "teacher";
      await user.save();
    }

    const mappedUser = toUserResponse(user);
    const token = signAuthToken({
      id: mappedUser.id,
      email: mappedUser.email,
      role: mappedUser.role,
    });

    return {
      data: {
        token,
        user: mappedUser,
      } satisfies AuthSuccessData,
      statusCode: 200,
    };
  } catch {
    return { data: { message: "Invalid user id" }, statusCode: 400 };
  }
};

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

export const listUsers = async (includeDeleted = false) => {
  try {
    const users = await userModel
      .find(includeDeleted ? {} : { deletedAt: null })
      .select("_id firstName lastName userName country email role deletedAt")
      .sort({ createdAt: -1 });

    const mapped = users.map((user) => ({
      ...toUserResponse(user),
      deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
    }));

    return {
      statusCode: 200,
      data: {
        users: mapped,
        total: mapped.length,
      },
    };
  } catch (error) {
    return {
      statusCode: 500,
      data: { message: (error as Error).message || "Failed to fetch users" },
    };
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
      return { data: { message: "User not found" }, statusCode: 404 };
    }

    return { data: { message: "User deleted successfully" }, statusCode: 200 };
  } catch (error: any) {
    return { data: { message: error.message }, statusCode: 500 };
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
      return { data: { message: "User not found" }, statusCode: 404 };
    }

    return { data: { message: "User restored successfully" }, statusCode: 200 };
  }catch (error: any) {
    return { data: { message: error.message }, statusCode: 500 };
  }
};

export const getDashboardStats = async (viewer: { userId: string; role: UserRole }) => {
  try {
    const viewerId = new Types.ObjectId(viewer.userId);

    if (viewer.role === "admin") {
      const [users, courses, payments] = await Promise.all([
        userModel.countDocuments({ deletedAt: null }),
        Course.countDocuments({}),
        Payment.countDocuments({}),
      ]);

      return {
        statusCode: 200,
        data: {
          role: "admin",
          stats: {
            users,
            courses,
            payments,
          },
        },
      };
    }

    if (viewer.role === "teacher") {
      const teacherCourses = await Course.find({ instructor: viewerId }).select("_id").lean();
      const courseIds = teacherCourses.map((course) => course._id);

      if (courseIds.length === 0) {
        return {
          statusCode: 200,
          data: {
            role: "teacher",
            stats: {
              myCourses: 0,
              enrolledStudents: 0,
              publishedQuizzes: 0,
            },
          },
        };
      }

      const [enrolledStudents, publishedQuizzes] = await Promise.all([
        Enrollment.countDocuments({ course: { $in: courseIds } }),
        Quiz.countDocuments({ course: { $in: courseIds }, isPublished: true }),
      ]);

      return {
        statusCode: 200,
        data: {
          role: "teacher",
          stats: {
            myCourses: courseIds.length,
            enrolledStudents,
            publishedQuizzes,
          },
        },
      };
    }

    const [enrolledCourses, completedAssessments, certificates] = await Promise.all([
      Enrollment.countDocuments({ student: viewerId }),
      QuizAttempt.countDocuments({ student: viewerId }),
      Certificate.countDocuments({ student: viewerId }),
    ]);

    return {
      statusCode: 200,
      data: {
        role: "student",
        stats: {
          enrolledCourses,
          completedAssessments,
          certificates,
        },
      },
    };
  } catch (error) {
    return {
      statusCode: 500,
      data: { message: (error as Error).message || "Failed to load dashboard stats" },
    };
  }
};

