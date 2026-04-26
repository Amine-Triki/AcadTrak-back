import userModel from "./user.model.js";
import bcrypt from "bcrypt";
import { registerSchema, loginSchema, updateProfileSchema } from "./user-validation.js";
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
  bio?: string;
  avatar?: string;
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
  bio?: string;
  avatar?: string;
}): UserResponse => ({
  id: String(user._id),
  firstName: user.firstName,
  lastName: user.lastName,
  userName: user.userName,
  country: user.country,
  email: user.email,
  role: user.role,
  ...(typeof user.bio === "string" ? { bio: user.bio } : {}),
  ...(typeof user.avatar === "string" ? { avatar: user.avatar } : {}),
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

    // ✅ إذا كان المستخدم أستاذاً بالفعل، نُخبره بوضوح
    if (user.role === "teacher") {
      return { data: { message: "You are already a teacher" }, statusCode: 400 };
    }

    // student → teacher
    user.role = "teacher";
    await user.save();

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
      .select("_id firstName lastName userName country email role bio avatar");

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

export const getPublicTeacherProfile = async (userId: string) => {
  try {
    const user = await userModel
      .findOne({ _id: userId, deletedAt: null })
      .select("_id firstName lastName userName country role bio avatar createdAt");

    if (!user) {
      return { data: { message: "User not found" }, statusCode: 404 };
    }

    // ✅ فقط الأستاذ يمكن عرض ملفه كـ instructor — Admin ليس مدرساً
    if (user.role !== 'teacher') {
      return { data: { message: 'This user is not an instructor' }, statusCode: 400 };
    }

    return {
      statusCode: 200,
      data: {
        user: {
          id: String(user._id),
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          country: user.country,
          role: user.role,
          bio: user.bio,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
      },
    };
  } catch {
    return { data: { message: "Invalid user id" }, statusCode: 400 };
  }
};

export const updateMyProfile = async (userId: string, payload: unknown) => {
  try {
    const validated = updateProfileSchema.parse(payload);

    const existingUser = await userModel.findOne({ _id: userId, deletedAt: null });
    if (!existingUser) {
      return { data: { message: "User not found" }, statusCode: 404 };
    }

    if (validated.userName && validated.userName !== existingUser.userName) {
      const duplicate = await userModel.findOne({
        userName: validated.userName,
        deletedAt: null,
        _id: { $ne: existingUser._id },
      }).select("_id");

      if (duplicate) {
        return { data: { message: "Username already exists" }, statusCode: 400 };
      }
    }

    Object.assign(existingUser, validated);
    await existingUser.save();

    return {
      statusCode: 200,
      data: {
        message: "Profile updated successfully",
        user: toUserResponse(existingUser),
      },
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        data: { message: error.issues[0]?.message || "Validation error" },
        statusCode: 400,
      };
    }

    return {
      statusCode: 500,
      data: { message: (error as Error).message || "Failed to update profile" },
    };
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
export const softDeleteUser = async (targetUserId: string, actorUserId: string) => {
  try {
    // ✅ منع حذف النفس
    if (targetUserId === actorUserId) {
      return { data: { message: "You cannot delete your own account" }, statusCode: 400 };
    }

    const user = await userModel.findById(targetUserId);
    if (!user) {
      return { data: { message: "User not found" }, statusCode: 404 };
    }

    // ✅ منع حذف حسابات Admin الأخرى
    if (user.role === "admin") {
      return { data: { message: "Admin accounts cannot be deleted" }, statusCode: 400 };
    }

    user.deletedAt = new Date();
    await user.save();

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
      const [users, courses, payments, paymentsByStatus] = await Promise.all([
        userModel.countDocuments({ deletedAt: null }),
        Course.countDocuments({}),
        Payment.countDocuments({}),
        Payment.aggregate<{ _id: string; count: number }>([
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      const paymentStatusMap = {
        pending: 0,
        success: 0,
        failed: 0,
        expired: 0,
      };

      for (const item of paymentsByStatus) {
        if (item._id in paymentStatusMap) {
          paymentStatusMap[item._id as keyof typeof paymentStatusMap] = item.count;
        }
      }

      return {
        statusCode: 200,
        data: {
          role: "admin",
          stats: {
            users,
            courses,
            payments,
            paymentsByStatus: paymentStatusMap,
          },
        },
      };
    }

    if (viewer.role === "teacher") {
      const teacherCourses = await Course.find({ instructor: viewerId }).select("_id").lean();
      const courseIds = teacherCourses.map((course) => course._id);

      const [enrolledStudents, publishedQuizzes, myEnrollments, myCertificates] = await Promise.all([
        courseIds.length > 0
          ? Enrollment.countDocuments({ course: { $in: courseIds } })
          : Promise.resolve(0),
        courseIds.length > 0
          ? Quiz.countDocuments({ course: { $in: courseIds }, isPublished: true })
          : Promise.resolve(0),
        // ✅ الأستاذ قد يكون مسجلاً في دورات أخرى كطالب
        Enrollment.countDocuments({ student: viewerId }),
        Certificate.countDocuments({ student: viewerId }),
      ]);

      return {
        statusCode: 200,
        data: {
          role: "teacher",
          stats: {
            myCourses: courseIds.length,
            enrolledStudents,
            publishedQuizzes,
            // إحصائيات الأستاذ كطالب
            enrolledAsStudent: myEnrollments,
            certificates: myCertificates,
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

