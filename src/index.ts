import app from "./app.js";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
dotenv.config();
/* import { env } from "./config/env.js";
 */
// تخزين مرجع للسيرفر لإغلاقه لاحقاً
const server = app.listen(process.env.port, async () => {
  await connectDB();
  console.log(`🚀 AcadTrak is running on port ${process.env.port}`);
});

// دالة الإغلاق النظيف
const gracefulShutdown = (signal: string) => {
  console.log(`\nSafe Exit: ${signal} received. Closing HTTP server...`);
  
  server.close(async () => {
    console.log("HTTP server closed.");
    
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
      process.exit(0); // الخروج بنجاح
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1); // الخروج مع خطأ
    }
  });
};

// الاستماع لإشارات الإغلاق
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // إشارة من السيرفر (مثل Docker)
process.on("SIGINT", () => gracefulShutdown("SIGINT"));   // إشارة Ctrl+C من الطرفية