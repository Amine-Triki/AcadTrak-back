import "dotenv/config";
import { z } from "zod";

//✅ Definition of all required variables and their types
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
  KONNECT_API_KEY:         z.string().min(1, "KONNECT_API_KEY is required"),
  KONNECT_WALLET_ID:       z.string().min(1, "KONNECT_WALLET_ID is required"),
  FRONTEND_URL:            z.url("FRONTEND_URL must be a valid URL").default("http://localhost:5173"),
  BACKEND_URL:             z.url("BACKEND_URL must be a valid URL").default("http://localhost:5000"),
});

// Validation when starting the server
const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("❌ Invalid environment variables:");
  result.error.issues.forEach((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "env";
    console.error(`   ${path}: ${issue.message}`);
  });
  process.exit(1);   // The server stops immediately
}

export const env = result.data;