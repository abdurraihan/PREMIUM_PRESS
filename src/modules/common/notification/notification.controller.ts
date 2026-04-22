import { Request, Response, NextFunction } from 'express';
import { Notification } from './notification.model';
import { Reader } from '../../reader/auth/reader.model';
import { Writer } from '../../writer/auth/writer.auth.model';
import { createError } from '../../../utils/ApiError';

// ─────────────────────────────────────────
// Helper — resolves who is calling from the request
// ─────────────────────────────────────────
const getReceiverFromRequest = (req: Request): { receiverId: string; receiverRole: string } | null => {
  if (req.readerId) return { receiverId: req.readerId, receiverRole: 'reader' };
  if (req.writerId) return { receiverId: req.writerId, receiverRole: 'writer' };
  if (req.editorId) return { receiverId: req.editorId, receiverRole: 'editor' };
  if (req.adminId) return { receiverId: req.adminId, receiverRole: 'admin' };
  return null;
};

// ─────────────────────────────────────────
// GET /api/v1/notification
// Get paginated notifications for the authenticated user (any role)
// ─────────────────────────────────────────
const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receiver = getReceiverFromRequest(req);
    if (!receiver) throw createError(401, 'Unauthorized');

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ receiver: receiver.receiverId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v'),
      Notification.countDocuments({ receiver: receiver.receiverId }),
      Notification.countDocuments({ receiver: receiver.receiverId, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/v1/notification/:id/read
// Mark a single notification as read
// ─────────────────────────────────────────
const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receiver = getReceiverFromRequest(req);
    if (!receiver) throw createError(401, 'Unauthorized');

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, receiver: receiver.receiverId },
      { isRead: true },
      { new: true }
    );

    if (!notification) throw createError(404, 'Notification not found');

    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/v1/notification/read-all
// Mark all notifications as read for this user
// ─────────────────────────────────────────
const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receiver = getReceiverFromRequest(req);
    if (!receiver) throw createError(401, 'Unauthorized');

    await Notification.updateMany(
      { receiver: receiver.receiverId, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE /api/v1/notification/:id
// Delete a single notification
// ─────────────────────────────────────────
const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receiver = getReceiverFromRequest(req);
    if (!receiver) throw createError(401, 'Unauthorized');

    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      receiver: receiver.receiverId,
    });

    if (!notification) throw createError(404, 'Notification not found');

    return res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/v1/notification/update-token
// Save FCM device token for push notifications
// Works for both reader and writer
// ─────────────────────────────────────────
const updateFcmToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) throw createError(400, 'fcmToken is required');

    const receiver = getReceiverFromRequest(req);
    if (!receiver) throw createError(401, 'Unauthorized');

    if (receiver.receiverRole === 'reader') {
      await Reader.findByIdAndUpdate(receiver.receiverId, { fcmToken });
    } else if (receiver.receiverRole === 'writer') {
      await Writer.findByIdAndUpdate(receiver.receiverId, { fcmToken });
    }

    return res.status(200).json({ success: true, message: 'FCM token updated' });
  } catch (error) {
    next(error);
  }
};

export { getNotifications, markAsRead, markAllAsRead, deleteNotification, updateFcmToken };
