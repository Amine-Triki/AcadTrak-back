import mongoose, {Schema ,Document } from 'mongoose';


export interface IUser extends Document {
firstName: string;
lastName: string;
  userName:string;
  country:string;
  bio?: string;
  avatar?: string;
  role: 'student' | 'teacher' | 'admin';
email: string;
password: string;
deletedAt?: Date | null;
}

const userSchema = new Schema<IUser>({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    userName: { type: String, required: true , unique:true},
    country: { type: String, required: true },
    bio: { type: String, default: "" },
    avatar: { type: String, default: "" },
    role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true , minlength:8 },
    deletedAt: { type: Date, default: null }
    }, {
    timestamps: true
});

// Add index for soft delete queries
userSchema.index({ deletedAt: 1 });

const userModel = mongoose.model<IUser>('User', userSchema);
export default userModel;