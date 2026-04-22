import { Schema, model, Document } from 'mongoose';


// Interest categories — exactly matching the UI
export type ReaderInterest = 'explore' | 'politics' | 'business' | 'finance' | 'technology';

export interface IReader extends Document {
  name: string;
  email: string;
  password: string;
  otp: string | null;
  otpExpiry: Date | null;
  isVerified: boolean;
  isSubscribed: boolean;
  stripeCustomerId: string | null;
  fcmToken: string | null;
  profileImage: string;
  phoneNumber: string | null;
  bio: string;
  isSocialLogin: boolean;
  city: string | null;
  age: number | null;
  interest: ReaderInterest;// single value now
  followingCount:number;
}

const readerSchema = new Schema<IReader>(
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
    isSubscribed: { type: Boolean, default: false },
    stripeCustomerId: { type: String, default: null, select: false },
    fcmToken: { type: String, default: null, select: false },

    profileImage: {
      type: String,
      default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png',
    },

    phoneNumber: {
      type: String,
      default: null,
     // match: [/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'],
    },

    bio: {
      type: String,
      default: 'my bio',
      maxlength: [300, 'Bio cannot exceed 300 characters'],
    },

    isSocialLogin: { type: Boolean, default: false },

    // City — any free text string
    city: {
      type: String,
      default: null,
      trim: true,
    },

    // Age — must be a realistic number
    age: {
      type: Number,
      default: null,
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age must be below 120'],
    },

    // Interests — array of allowed categories from the UI
    interest: {
      type: String,
      enum: {
        values: ['explore', 'politics', 'business', 'finance', 'technology', 'culture' , 'gestronomy' , 'idx'],
        message: '{VALUE} is not a valid interest',
      },
      default: 'explore',
    },

    followingCount: {
  type: Number,
  default: 0,
},
  },
  { timestamps: true }
);

export const Reader = model<IReader>('Reader', readerSchema);