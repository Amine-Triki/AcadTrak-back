import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.MONGO_URI);
    console.log(` MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(" MongoDB connection error:", error);
    process.exit(1); // Shut down the server because the rule is essential 
}
};