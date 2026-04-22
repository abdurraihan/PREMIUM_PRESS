import { Types } from 'mongoose';
import { Notification, NotificationType, ReceiverRole } from '../modules/common/notification/notification.model';
import { Reader } from '../modules/reader/auth/reader.model';
import { Writer } from '../modules/writer/auth/writer.auth.model';
import { Editor } from '../modules/editor/auth/editor.model';
import { sendSocketNotification } from '../config/socket';
import { sendPushNotification } from '../config/firebase';
import {Follow}   from '../modules/common/follow-unfollow/followUnfollow.model'

export interface SendNotificationParams {
  receiver: Types.ObjectId | string;
  receiverRole: ReceiverRole;
  type: NotificationType;
  message: string;
  contentType?: string;
  contentId?: Types.ObjectId | string;
}

export interface NotifyAllFollowersParams {
  writerId: string;
  writerName: string;
  type: NotificationType;
  message: string;
  contentType: string;
  contentId: string;
}

// ─────────────────────────────────────────
// Send a notification to a single user.
// Creates DB record → fires socket event → sends push if fcmToken exists.
// ─────────────────────────────────────────
export const sendNotification = async (params: SendNotificationParams): Promise<void> => {
  const { receiver, receiverRole, type, message, contentType, contentId } = params;

  const notification = await Notification.create({
    receiver,
    receiverRole,
    type,
    message,
    contentType: contentType || null,
    contentId: contentId || null,
  });

  // Real-time socket push
  sendSocketNotification(receiver.toString(), 'notification', notification.toObject());

  // FCM push notification
  let fcmToken: string | null = null;
  try {
    if (receiverRole === 'reader') {
      const user = await Reader.findById(receiver).select('+fcmToken');
      fcmToken = user?.fcmToken || null;
    } else if (receiverRole === 'writer') {
      const user = await Writer.findById(receiver).select('+fcmToken');
      fcmToken = user?.fcmToken || null;
    } else if (receiverRole === 'editor') {
      const user = await Editor.findById(receiver).select('+fcmToken');
      fcmToken = user?.fcmToken || null;
    }

    if (fcmToken) {
      await sendPushNotification(fcmToken, 'PremiumPress', message, {
        type,
        contentType: contentType || '',
        contentId: contentId?.toString() || '',
      });
    }
  } catch {
    // Push failure is non-fatal — notification is already saved and socket sent
  }
};

// ─────────────────────────────────────────
// Notify all readers who follow a writer.
// Used when a writer's content is published.
// Batch inserts notifications, fires sockets per reader, then batch push.
// ─────────────────────────────────────────
export const notifyAllFollowers = async (params: NotifyAllFollowersParams): Promise<void> => {
  const { writerId, type, message, contentType, contentId } = params;

  // Lazy import to avoid circular dependency issues
 
  const follows = await Follow.find({ writer: writerId }).select('reader').lean();
  if (!follows.length) return;

  const readerIds = follows.map((f: any) => f.reader);

  // Batch insert all notifications
  const docs = readerIds.map((readerId: Types.ObjectId) => ({
    receiver: readerId,
    receiverRole: 'reader' as ReceiverRole,
    type,
    message,
    contentType,
    contentId,
    isRead: false,
  }));

  const created = await Notification.insertMany(docs);

  // Socket: fire per reader
  for (const notif of created) {
    sendSocketNotification(notif.receiver.toString(), 'notification', notif.toObject());
  }

  // Push: batch-query readers that have an fcmToken
  const readers = await Reader.find({ _id: { $in: readerIds } }).select('+fcmToken').lean();
  for (const reader of readers) {
    if ((reader as any).fcmToken) {
      await sendPushNotification(
        (reader as any).fcmToken,
        'PremiumPress',
        message,
        { type, contentType, contentId }
      ).catch(() => {});
    }
  }
};
