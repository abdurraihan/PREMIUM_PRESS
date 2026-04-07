import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Editor } from './editor.model';
import { generateTokens } from '../../../utils/jwt.utils';
import { sendOtpEmail } from '../../../utils/email.utils';
import { createError } from '../../../utils/ApiError';

const generateOtp = (): string => Math.floor(1000 + Math.random() * 9000).toString();

// ─────────────────────────────────────────
// POST /api/editor/auth/signup
// Developer only — no OTP, direct account creation
// ─────────────────────────────────────────
const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const exists = await Editor.findOne({ email });
    if (exists) throw createError(400, 'Email already registered');

    const hashed = await bcrypt.hash(password, 10);

    // No OTP — editor account is created instantly
    const editor = await Editor.create({ name, email, password: hashed });

    return res.status(201).json({
      success: true,
      message: 'Editor account created successfully.',
      data: { id: editor._id, email: editor.email },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/editor/auth/login
// ─────────────────────────────────────────
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError(400, 'Email and password are required');

    const editor = await Editor.findOne({ email }).select('+password');
    if (!editor) throw createError(401, 'Invalid credentials');

    const match = await bcrypt.compare(password, editor.password);
    if (!match) throw createError(401, 'Invalid credentials');

    const { access_token, refresh_token } = generateTokens(editor._id.toString(), 'editor');

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: editor._id,
        name: editor.name,
        email: editor.email,
        profileImage: editor.profileImage,
      },
      access_token,
      refresh_token,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/editor/auth/forgot-password
// ─────────────────────────────────────────
const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw createError(400, 'Email is required');

    const editor = await Editor.findOne({ email }).select('+otp +otpExpiry');
    if (!editor) throw createError(404, 'No account found with this email');

    const otp = generateOtp();
    editor.otp = otp;
    editor.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await editor.save();

    await sendOtpEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/editor/auth/reset-password
// ─────────────────────────────────────────
const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) throw createError(400, 'Email, OTP and new password are required');
    if (newPassword.length < 6) throw createError(400, 'Password must be at least 6 characters');

    const editor = await Editor.findOne({ email }).select('+otp +otpExpiry +password');
    if (!editor) throw createError(404, 'Editor not found');
    if (!editor.otp || editor.otp !== otp) throw createError(400, 'Invalid OTP');
    if (!editor.otpExpiry || editor.otpExpiry < new Date()) throw createError(400, 'OTP has expired');

    editor.password = await bcrypt.hash(newPassword, 10);
    editor.otp = null;
    editor.otpExpiry = null;
    await editor.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login.',
    });
  } catch (error) {
    next(error);
  }
};

export { signup, login, forgotPassword, resetPassword };