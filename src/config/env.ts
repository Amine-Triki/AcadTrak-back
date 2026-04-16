import "dotenv/config";
import { z } from "zod";

// ✅ تعريف كل المتغيرات المطلوبة وأنواعها
const envSchema = z.object({
  PORT:                    z.string().default("5000"),
  MONGO_URI:               z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET:              z.string().min(10, "JWT_SECRET too short"),
  JWT_EXPIRES_IN:          z.string().default("7d"),
  AUTH_COOKIE_NAME:        z.string().default("acadtrak_access_token"),
  CORS_ORIGIN:             z.string().default("http://localhost:5173"),
  CLOUDINARY_CLOUD_NAME:   z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY:      z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET:   z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  NODE_ENV:                z.enum(["development", "production", "test"]).default("development"),
});

// التحقق عند تشغيل السيرفر
const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment variables:");
  result.error.issues.forEach((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "env";
    console.error(`   ${path}: ${issue.message}`);
  });
  process.exit(1); // يوقف السيرفر فوراً
}

export const env = result.data;