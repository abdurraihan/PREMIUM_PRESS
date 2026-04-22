import { Schema, model, Document } from 'mongoose';

export interface IEditor extends Document {
  name: string;
  email: string;
  password: string;
  phone: string | null;
  profileImage: string;
  otp: string | null;
  otpExpiry: Date | null;
  fcmToken: string | null;
}

const editorSchema = new Schema<IEditor>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },

    phone: {
      type: String,
      default: null,
    //match: [/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'],
    },

    profileImage: {
      type: String,
      default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
    },

    // OTP only used for forgot password
    otp: { type: String, default: null, select: false },
    otpExpiry: { type: Date, default: null, select: false },
    fcmToken: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

export const Editor = model<IEditor>('Editor', editorSchema);