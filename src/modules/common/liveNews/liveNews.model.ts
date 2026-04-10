import { Schema, model, Document, Types } from 'mongoose';

export interface ILiveNews extends Document {
  content: string;        // short news content max 1000 chars — no title
  author: Types.ObjectId; // ref to Writer
  postedAt: Date;         // time shown in UI like "15:07"
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

    // Writer posts directly — no editor flow needed
    postedAt: {
      type: Date,
      default: Date.now,
    },

    type: {
      type: String,
      default: 'liveNews',
      immutable: true,
    },
  },
  { timestamps: true }
);

export const LiveNews = model<ILiveNews>('LiveNews', liveNewsSchema);