import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Editor } from '../auth/editor.model';
import { createError } from '../../../utils/ApiError';
import { uploadImageToS3, deleteImageFromS3 } from '../../../utils/s3.utils';

// GET /api/editor/profile/get-profile
const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const editor = await Editor.findById(req.editorId);
    if (!editor) throw createError(404, 'Editor not found');

    return res.status(200).json({
      success: true,
      data: editor,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/editor/profile/edit
// form-data: name, phone, profileImage (file)
const editProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone } = req.body;

    const editor = await Editor.findById(req.editorId);
    if (!editor) throw createError(404, 'Editor not found');

    if (req.file) {
      const isDefault = editor.profileImage.includes('pixabay.com');
      if (!isDefault) {
        await deleteImageFromS3(editor.profileImage);
      }
      const newImageUrl = await uploadImageToS3(req.file.buffer, req.file.mimetype);
      editor.profileImage = newImageUrl;
    }

    if (name) editor.name = name;
    if (phone) editor.phone = phone;

    await editor.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: editor,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/editor/profile/change-password
const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) throw createError(400, 'Old and new password are required');
    if (newPassword.length < 6) throw createError(400, 'New password must be at least 6 characters');

    const editor = await Editor.findById(req.editorId).select('+password');
    if (!editor) throw createError(404, 'Editor not found');

    const match = await bcrypt.compare(oldPassword, editor.password);
    if (!match) throw createError(400, 'Old password is incorrect');

    editor.password = await bcrypt.hash(newPassword, 10);
    await editor.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/editor/profile/delete
const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const editor = await Editor.findById(req.editorId);
    if (!editor) throw createError(404, 'Editor not found');

    const isDefault = editor.profileImage.includes('pixabay.com');
    if (!isDefault) {
      await deleteImageFromS3(editor.profileImage);
    }

    await Editor.findByIdAndDelete(req.editorId);

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export { getProfile, editProfile, changePassword, deleteAccount };