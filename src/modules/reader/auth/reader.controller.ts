import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Reader } from './reader.model';
import { generateTokens } from '../../../utils/jwt.utils';
import { sendOtpEmail } from '../../../utils/email.utils';
import { createError } from '../../../utils/ApiError';

// Generate a random 4-digit OTP
const generateOtp = (): string => Math.floor(1000 + Math.random() * 9000).toString();

// ─────────────────────────────────────────
// POST /api/reader/auth/signup
// ─────────────────────────────────────────
const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    // Check required fields — model handles format validation
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    // Check duplicate email
    const exists = await Reader.findOne({ email });
    if (exists) throw createError(400, 'Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Model validators (minlength, match etc) run automatically on create
    const reader = await Reader.create({ name, email, password: hashed, otp, otpExpiry });

    await sendOtpEmail(email, otp);

    return res.status(201).json({
      success: true,
      message: 'Account created. Check your email for the OTP.',
      data: { id: reader._id, email: reader.email },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/reader/auth/verify-otp
// ─────────────────────────────────────────
const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw createError(400, 'Email and OTP are required');

    // Need otp and otpExpiry fields — select: false in model
    const reader = await Reader.findOne({ email }).select('+otp +otpExpiry');
    if (!reader) throw createError(404, 'Reader not found');
    if (reader.isVerified) throw createError(400, 'Account already verified');
    if (!reader.otp || reader.otp !== otp) throw createError(400, 'Invalid OTP');
    if (!reader.otpExpiry || reader.otpExpiry < new Date()) throw createError(400, 'OTP has expired');

    // Mark as verified and clear OTP
    reader.isVerified = true;
    reader.otp = null;
    reader.otpExpiry = null;
    await reader.save();

    const { access_token, refresh_token } = generateTokens(reader._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      access_token,
      refresh_token,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/reader/auth/resend-otp
// ─────────────────────────────────────────
const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw createError(400, 'Email is required');

    const reader = await Reader.findOne({ email }).select('+otp +otpExpiry');
    if (!reader) throw createError(404, 'Reader not found');
    if (reader.isVerified) throw createError(400, 'Account already verified');

    // Generate fresh OTP
    const otp = generateOtp();
    reader.otp = otp;
    reader.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await reader.save();

    await sendOtpEmail(email, otp);

    return res.status(200).json({
      success: true,
      message: 'New OTP sent to your email',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/reader/auth/login
// ─────────────────────────────────────────
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError(400, 'Email and password are required');

    // Need password field — select: false in model
    const reader = await Reader.findOne({ email }).select('+password');
    if (!reader) throw createError(401, 'Invalid credentials');
    if (!reader.isVerified) throw createError(403, 'Please verify your email first');

    const match = await bcrypt.compare(password, reader.password);
    if (!match) throw createError(401, 'Invalid credentials');

    const { access_token, refresh_token } = generateTokens(reader._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: reader._id,
        name: reader.name,
        email: reader.email,
        profileImage: reader.profileImage,
        isSubscribed: reader.isSubscribed,
        bio: reader.bio,
      },
      access_token,
      refresh_token,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/reader/auth/social-login
// Frontend sends: name, email, photo from Google/Apple
// ─────────────────────────────────────────
const socialLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, photo } = req.body;
    if (!name || !email) throw createError(400, 'Name and email are required');

    let reader = await Reader.findOne({ email });

    // Auto create account if first time social login
    if (!reader) {
      const generatedPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      reader = await Reader.create({
        name,
        email,
        password: hashedPassword,
        profileImage: photo || undefined,
        isVerified: true,       // social = auto verified
        isSocialLogin: true,
      });
    }

    const { access_token, refresh_token } = generateTokens(reader._id.toString());

    return res.status(200).json({
      success: true,
      message: 'Social login successful',
      data: {
        id: reader._id,
        name: reader.name,
        email: reader.email,
        profileImage: reader.profileImage,
        isSubscribed: reader.isSubscribed,
      },
      access_token,
      refresh_token,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/reader/auth/forgot-password
// ─────────────────────────────────────────
const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw createError(400, 'Email is required');

    const reader = await Reader.findOne({ email });
    if (!reader) throw createError(404, 'No account found with this email');

    const otp = generateOtp();
    reader.otp = otp;
    reader.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await reader.save();

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
// POST /api/reader/auth/reset-password
// ─────────────────────────────────────────
const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) throw createError(400, 'Email, OTP and new password are required');
    if (newPassword.length < 6) throw createError(400, 'Password must be at least 6 characters');

    const reader = await Reader.findOne({ email }).select('+otp +otpExpiry +password');
    if (!reader) throw createError(404, 'Reader not found');
    if (!reader.otp || reader.otp !== otp) throw createError(400, 'Invalid OTP');
    if (!reader.otpExpiry || reader.otpExpiry < new Date()) throw createError(400, 'OTP has expired');

    reader.password = await bcrypt.hash(newPassword, 10);
    reader.otp = null;
    reader.otpExpiry = null;
    await reader.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login.',
    });
  } catch (error) {
    next(error);
  }
};

export { signup, verifyOtp, resendOtp, login, socialLogin, forgotPassword, resetPassword };