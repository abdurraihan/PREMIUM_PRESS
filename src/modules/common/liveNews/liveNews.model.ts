import { Schema, model, Document, Types } from 'mongoose';

export type LiveNewsStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'revision';

export interface ILiveNews extends Document {
  content: string;
  author: Types.ObjectId;
  postedAt: Date;
  status: LiveNewsStatus;
  feedback: string | null;
  scheduledAt: Date | null;
  type: 'liveNews';
}

const liveNewsSchema = new Schema<ILiveNews>(
  {
    content: {
      type: String,
      required: [true, 'News content is required'],
      trim: true,
      maxlength: [1000, 'News content cannot exceed 1000 characters'],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'Writer',
      required: [true, 'Author is required'],
    },
    postedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'published', 'rejected', 'revision'],
      default: 'draft',
    },
    feedback: { type: String, default: null },
    scheduledAt: { type: Date, default: null },
    type: {
      type: String,
      default: 'liveNews',
      immutable: true,
    },
  },
  { timestamps: true }
);

export const LiveNews = model<ILiveNews>('LiveNews', liveNewsSchema);
