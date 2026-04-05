import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Reader } from '../auth/reader.model';
import { createError } from '../../../utils/ApiError';
import { uploadImageToS3, deleteImageFromS3 } from '../../../utils/s3.utils';

// GET /api/reader/profile/get-profile
const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reader = await Reader.findById(req.readerId);
    if (!reader) throw createError(404, 'Reader not found');

    return res.status(200).json({
      success: true,
      data: reader,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/reader/profile/edit
// form-data: name, phoneNumber, bio, city, age, interests (array), profileImage (file)
const editProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phoneNumber, bio, city, age, interest } = req.body;

    const reader = await Reader.findById(req.readerId);
    if (!reader) throw createError(404, 'Reader not found');

    // Handle new profile image upload
    if (req.file) {
      const isDefault = reader.profileImage.includes('pixabay.com');
      if (!isDefault) {
        await deleteImageFromS3(reader.profileImage);
      }
      const newImageUrl = await uploadImageToS3(req.file.buffer, req.file.mimetype);
      reader.profileImage = newImageUrl;
    }

   // Update only fields that were actually sent
if (name) reader.name = name;
if (phoneNumber) reader.phoneNumber = phoneNumber;
if (bio) reader.bio = bio;
if (city) reader.city = city;
if (age) reader.age = Number(age);
if (interest) reader.interest = interest;

    await reader.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: reader,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/reader/profile/change-password
const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) throw createError(400, 'Old and new password are required');
    if (newPassword.length < 6) throw createError(400, 'New password must be at least 6 characters');

    const reader = await Reader.findById(req.readerId).select('+password');
    if (!reader) throw createError(404, 'Reader not found');

    const match = await bcrypt.compare(oldPassword, reader.password);
    if (!match) throw createError(400, 'Old password is incorrect');

    reader.password = await bcrypt.hash(newPassword, 10);
    await reader.save();

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/reader/profile/delete
const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reader = await Reader.findById(req.readerId);
    if (!reader) throw createError(404, 'Reader not found');

    const isDefault = reader.profileImage.includes('pixabay.com');
    if (!isDefault) {
      await deleteImageFromS3(reader.profileImage);
    }

    await Reader.findByIdAndDelete(req.readerId);

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export { getProfile, editProfile, changePassword, deleteAccount };