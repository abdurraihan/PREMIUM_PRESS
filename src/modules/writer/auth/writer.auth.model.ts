import { Schema, model, Document } from 'mongoose';

export interface IWriter extends Document {
  name: string;
  email: string;
  password: string;
  otp: string | null;
  otpExpiry: Date | null;
  isVerified: boolean;
  profileImage: string;
  phoneNumber: string | null;
  bio: string;
  address: string | null;
  age: number | null;
  isSocialLogin: boolean;
  followersCount: number;
  fcmToken: string | null;
}

const writerSchema = new Schema<IWriter>(
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

    otp: { type: String, default: null, select: false },
    otpExpiry: { type: Date, default: null, select: false },

    isVerified: { type: Boolean, default: false },

    profileImage: {
      type: String,
      default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
    },

    phoneNumber: {
      type: String,
      default: null,
      //match: [/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'],
    },

    bio: {
      type: String,
      default: 'my bio',
      maxlength: [300, 'Bio cannot exceed 300 characters'],
    },

    address: {
      type: String,
      default: null,
      trim: true,
    },

    age: {
      type: Number,
      default: null,
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age must be below 120'],
    },
   followersCount: {
  type: Number,
  default: 0,
},

    isSocialLogin: { type: Boolean, default: false },
    fcmToken: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

export const Writer = model<IWriter>('Writer', writerSchema);