import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType =
  | 'new_story'
  | 'new_podcast'
  | 'new_liveNews'
  | 'story_approved'
  | 'story_rejected'
  | 'story_revision'
  | 'podcast_approved'
  | 'podcast_rejected'
  | 'podcast_revision'
  | 'liveNews_approved'
  | 'liveNews_rejected'
  | 'liveNews_revision'
  | 'new_comment'
  | 'comment_reply'
  | 'new_follower'
  | 'new_story_pending'
  | 'new_podcast_pending'
  | 'new_liveNews_pending'
  | 'subscription_activated'
  | 'subscription_expiring'
  | 'subscription_expired'
  | 'subscription_cancelled'
  | 'new_user_registered'
  | 'new_subscription';

export type ReceiverRole = 'reader' | 'writer' | 'editor' | 'admin';

export interface INotification extends Document {
  receiver: Types.ObjectId;
  receiverRole: ReceiverRole;
  type: NotificationType;
  message: string;
  contentType: string | null;
  contentId: Types.ObjectId | null;
  isRead: boolean;
}

const notificationSchema = new Schema<INotification>(
  {
    receiver: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    receiverRole: {
      type: String,
      enum: ['reader', 'writer', 'editor', 'admin'],
      required: true,
    },
    type: {
      type: String,
      enum: [
        'new_story', 'new_podcast', 'new_liveNews',
        'story_approved', 'story_rejected', 'story_revision',
        'podcast_approved', 'podcast_rejected', 'podcast_revision',
        'liveNews_approved', 'liveNews_rejected', 'liveNews_revision',
        'new_comment', 'comment_reply', 'new_follower',
        'new_story_pending', 'new_podcast_pending', 'new_liveNews_pending',
        'subscription_activated', 'subscription_expiring', 'subscription_expired', 'subscription_cancelled',
        'new_user_registered', 'new_subscription',
      ],
      required: true,
    },
    message: { type: String, required: true },
    contentType: { type: String, default: null },
    contentId: { type: Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ receiver: 1, isRead: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);
