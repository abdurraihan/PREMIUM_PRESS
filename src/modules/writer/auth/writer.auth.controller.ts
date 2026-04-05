import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Writer } from './writer.auth.model';
import { generateTokens } from '../../../utils/jwt.utils';
import { sendOtpEmail } from '../../../utils/email.utils';
import { createError } from '../../../utils/ApiError';

// Generate a random 4-digit OTP
const generateOtp = (): string => Math.floor(1000 + Math.random() * 9000).toString();

// ─────────────────────────────────────────
// POST /api/writer/auth/signup
// ─────────────────────────────────────────
const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    // Check duplicate email
    const exists = await Writer.findOne({ email });
    if (exists) throw createError(400, 'Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const writer = await Writer.create({ name, email, password: hashed, otp, otpExpiry });

    await sendOtpEmail(email, otp);

    return res.status(201).json({
      success: true,
      message: 'Account created. Check your email for the OTP.',
      data: { id: writer._id, email: writer.email },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/writer/auth/verify-otp
// ─────────────────────────────────────────
const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw createError(400, 'Email and OTP are required');

    const writer = await Writer.findOne({ email }).select('+otp +otpExpiry');
    if (!writer) throw createError(404, 'Writer not found');
    if (writer.isVerified) throw createError(400, 'Account already verified');
    if (!writer.otp || writer.otp !== otp) throw createError(400, 'Invalid OTP');
    if (!writer.otpExpiry || writer.otpExpiry < new Date()) throw createError(400, 'OTP has expired');

    // Mark verified and clear OTP
    writer.isVerified = true;
    writer.otp = null;
    writer.otpExpiry = null;
    await writer.save();

    const { access_token, refresh_token } = generateTokens(writer._id.toString(), 'writer');

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
// POST /api/writer/auth/resend-otp
// ─────────────────────────────────────────
const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw createError(400, 'Email is required');

    const writer = await Writer.findOne({ email }).select('+otp +otpExpiry');
    if (!writer) throw createError(404, 'Writer not found');
    if (writer.isVerified) throw createError(400, 'Account already verified');

    const otp = generateOtp();
    writer.otp = otp;
    writer.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await writer.save();

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
// POST /api/writer/auth/login
// ─────────────────────────────────────────
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError(400, 'Email and password are required');

    const writer = await Writer.findOne({ email }).select('+password');
    if (!writer) throw createError(401, 'Invalid credentials');
    if (!writer.isVerified) throw createError(403, 'Please verify your email first');

    const match = await bcrypt.compare(password, writer.password);
    if (!match) throw createError(401, 'Invalid credentials');

    const { access_token, refresh_token } = generateTokens(writer._id.toString(), 'writer');

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: writer._id,
        name: writer.name,
        email: writer.email,
        profileImage: writer.profileImage,
        bio: writer.bio,
      },
      access_token,
      refresh_token,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/writer/auth/social-login
// Frontend sends: name, email, photo from Google/Apple
// ─────────────────────────────────────────
const socialLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, photo } = req.body;
    if (!name || !email) throw createError(400, 'Name and email are required');

    let writer = await Writer.findOne({ email });

    // Auto create account if first time social login
    if (!writer) {
      const generatedPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      writer = await Writer.create({
        name,
        email,
        password: hashedPassword,
        profileImage: photo || undefined,
        isVerified: true,         // social = auto verified
        isSocialLogin: true,
      });
    }

    const { access_token, refresh_token } = generateTokens(writer._id.toString(), 'writer');

    return res.status(200).json({
      success: true,
      message: 'Social login successful',
      data: {
        id: writer._id,
        name: writer.name,
        email: writer.email,
        profileImage: writer.profileImage,
      },
      access_token,
      refresh_token,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/writer/auth/forgot-password
// ─────────────────────────────────────────
const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw createError(400, 'Email is required');

    const writer = await Writer.findOne({ email });
    if (!writer) throw createError(404, 'No account found with this email');

    const otp = generateOtp();
    writer.otp = otp;
    writer.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await writer.save();

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
// POST /api/writer/auth/reset-password
// ─────────────────────────────────────────
const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) throw createError(400, 'Email, OTP and new password are required');
    if (newPassword.length < 6) throw createError(400, 'Password must be at least 6 characters');

    const writer = await Writer.findOne({ email }).select('+otp +otpExpiry +password');
    if (!writer) throw createError(404, 'Writer not found');
    if (!writer.otp || writer.otp !== otp) throw createError(400, 'Invalid OTP');
    if (!writer.otpExpiry || writer.otpExpiry < new Date()) throw createError(400, 'OTP has expired');

    writer.password = await bcrypt.hash(newPassword, 10);
    writer.otp = null;
    writer.otpExpiry = null;
    await writer.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login.',
    });
  } catch (error) {
    next(error);
  }
};

export { signup, verifyOtp, resendOtp, login, socialLogin, forgotPassword, resetPassword };