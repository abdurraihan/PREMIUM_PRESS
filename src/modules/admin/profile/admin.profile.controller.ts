import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Admin } from '../auth/admin.model';
import { Editor } from '../../editor/auth/editor.model';
import { createError } from '../../../utils/ApiError';
import { uploadImageToS3, deleteImageFromS3 } from '../../../utils/s3.utils';

// ─────────────────────────────────────────
// GET /api/admin/profile/get-profile
// ─────────────────────────────────────────
const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = await Admin.findById(req.adminId);
    if (!admin) throw createError(404, 'Admin not found');

    return res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/admin/profile/edit
// form-data: name, phone, profileImage (file)
// ─────────────────────────────────────────
const editProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone } = req.body;

    const admin = await Admin.findById(req.adminId);
    if (!admin) throw createError(404, 'Admin not found');

    // Handle new profile image upload to S3
    if (req.file) {
      const isDefault = admin.profileImage.includes('pixabay.com');
      if (!isDefault) {
        await deleteImageFromS3(admin.profileImage);
      }
      const newImageUrl = await uploadImageToS3(req.file.buffer, req.file.mimetype);
      admin.profileImage = newImageUrl;
    }

    if (name) admin.name = name;
    if (phone) admin.phone = phone;

    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: admin,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/admin/profile/change-password
// No OTP needed — just old and new password
// ─────────────────────────────────────────
const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) throw createError(400, 'Old and new password are required');
    if (newPassword.length < 6) throw createError(400, 'New password must be at least 6 characters');

    const admin = await Admin.findById(req.adminId).select('+password');
    if (!admin) throw createError(404, 'Admin not found');

    const match = await bcrypt.compare(oldPassword, admin.password);
    if (!match) throw createError(400, 'Old password is incorrect');

    admin.password = await bcrypt.hash(newPassword, 10);
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE /api/admin/profile/delete
// ─────────────────────────────────────────
const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = await Admin.findById(req.adminId);
    if (!admin) throw createError(404, 'Admin not found');

    const isDefault = admin.profileImage.includes('pixabay.com');
    if (!isDefault) {
      await deleteImageFromS3(admin.profileImage);
    }

    await Admin.findByIdAndDelete(req.adminId);

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/admin/profile/create-editor
// Only admin can create editor accounts
// ─────────────────────────────────────────
const createEditor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const exists = await Editor.findOne({ email });
    if (exists) throw createError(400, 'Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const editor = await Editor.create({ name, email, password: hashed });

    return res.status(201).json({
      success: true,
      message: 'Editor account created successfully.',
      data: { id: editor._id, name: editor.name, email: editor.email },
    });
  } catch (error) {
    next(error);
  }
};

export { getProfile, editProfile, changePassword, deleteAccount , createEditor};