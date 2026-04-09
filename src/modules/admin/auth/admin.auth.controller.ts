import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Admin } from './admin.model';

import { generateTokens } from '../../../utils/jwt.utils';
import { sendOtpEmail } from '../../../utils/email.utils';
import { createError } from '../../../utils/ApiError';


const generateOtp = (): string => Math.floor(1000 + Math.random() * 9000).toString();

// ─────────────────────────────────────────
// POST /api/admin/auth/signup
// Developer only — no OTP, direct account creation
// ─────────────────────────────────────────
const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const exists = await Admin.findOne({ email });
    if (exists) throw createError(400, 'Email already registered');

    const hashed = await bcrypt.hash(password, 10);

    // No OTP — admin is created instantly and ready to login
    const admin = await Admin.create({ name, email, password: hashed });

    return res.status(201).json({
      success: true,
      message: 'Admin account created successfully.',
      data: { id: admin._id, email: admin.email },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/admin/auth/login
// ─────────────────────────────────────────
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError(400, 'Email and password are required');

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) throw createError(401, 'Invalid credentials');

    const match = await bcrypt.compare(password, admin.password);
    if (!match) throw createError(401, 'Invalid credentials');

    const { access_token, refresh_token } = generateTokens(admin._id.toString(), 'admin');

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        profileImage: admin.profileImage,
      },
      access_token,
      refresh_token,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/admin/auth/forgot-password
// Send OTP to email for password reset
// ─────────────────────────────────────────
const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw createError(400, 'Email is required');

    const admin = await Admin.findOne({ email });
    if (!admin) throw createError(404, 'No account found with this email');

    const otp = generateOtp();
    admin.otp = otp;
    admin.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await admin.save();

    await sendOtpEmail(email, otp);
    console.log(email,otp)

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email',
    });
  } catch (error) {
    next(error);
  }
};


// ─────────────────────────────────────────
// POST /api/admin/auth/reset-password
// Verify OTP then set new password
// ─────────────────────────────────────────
const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) throw createError(400, 'Email, OTP and new password are required');
    if (newPassword.length < 6) throw createError(400, 'Password must be at least 6 characters');

    const admin = await Admin.findOne({ email }).select('+otp +otpExpiry +password');
    if (!admin) throw createError(404, 'Admin not found');
    if (!admin.otp || admin.otp !== otp) throw createError(400, 'Invalid OTP');
    if (!admin.otpExpiry || admin.otpExpiry < new Date()) throw createError(400, 'OTP has expired');

    admin.password = await bcrypt.hash(newPassword, 10);
    admin.otp = null;
    admin.otpExpiry = null;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login.',
    });
  } catch (error) {
    next(error);
  }
};




export { signup, login, forgotPassword, resetPassword};