import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Writer } from '../auth/writer.auth.model';
import { createError } from '../../../utils/ApiError';
import { uploadImageToS3, deleteImageFromS3 } from '../../../utils/s3.utils';

// ─────────────────────────────────────────
// GET /api/writer/profile/get-profile
// ─────────────────────────────────────────
const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const writer = await Writer.findById(req.writerId);
    if (!writer) throw createError(404, 'Writer not found');

    return res.status(200).json({
      success: true,
      data: writer,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/writer/profile/edit
// form-data: name, phoneNumber, bio, address, age, profileImage (file)
// ─────────────────────────────────────────
const editProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phoneNumber, bio, address, age } = req.body;

    const writer = await Writer.findById(req.writerId);
    if (!writer) throw createError(404, 'Writer not found');

    // Handle new profile image upload
    if (req.file) {
      const isDefault = writer.profileImage.includes('pixabay.com');
      if (!isDefault) {
        await deleteImageFromS3(writer.profileImage);
      }
      const newImageUrl = await uploadImageToS3(req.file.buffer, req.file.mimetype);
      writer.profileImage = newImageUrl;
    }

    // Update only fields that were actually sent
    if (name) writer.name = name;
    if (phoneNumber) writer.phoneNumber = phoneNumber;
    if (bio) writer.bio = bio;
    if (address) writer.address = address;
    if (age) writer.age = Number(age); // form-data sends strings so convert to number

    await writer.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: writer,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/writer/profile/change-password
// ─────────────────────────────────────────
const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) throw createError(400, 'Old and new password are required');
    if (newPassword.length < 6) throw createError(400, 'New password must be at least 6 characters');

    // Need password — select: false in model
    const writer = await Writer.findById(req.writerId).select('+password');
    if (!writer) throw createError(404, 'Writer not found');

    const match = await bcrypt.compare(oldPassword, writer.password);
    if (!match) throw createError(400, 'Old password is incorrect');

    writer.password = await bcrypt.hash(newPassword, 10);
    await writer.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE /api/writer/profile/delete
// ─────────────────────────────────────────
const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const writer = await Writer.findById(req.writerId);
    if (!writer) throw createError(404, 'Writer not found');

    // Delete S3 image only if it's not the default avatar
    const isDefault = writer.profileImage.includes('pixabay.com');
    if (!isDefault) {
      await deleteImageFromS3(writer.profileImage);
    }

    await Writer.findByIdAndDelete(req.writerId);

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export { getProfile, editProfile, changePassword, deleteAccount };