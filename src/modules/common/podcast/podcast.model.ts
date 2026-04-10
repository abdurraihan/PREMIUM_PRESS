import { Schema, model, Document, Types } from 'mongoose';

export type PodcastStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'revision';

export type PodcastCategory =
  | 'explore'
  | 'politics'
  | 'business'
  | 'finance'
  | 'technology'
  | 'culture'
  | 'gastronomy'
  | 'idx';

export interface IPodcast extends Document {
  title: string;
  summary: string;           // max 150 chars — shown in list
  aboutEpisode: string;      // full episode description — shown in detail
  coverImage: string;        // podcast cover — mandatory
  audioFile: string;         // S3 audio URL — mandatory
  audioDuration: number;     // in minutes — writer provides manually
  category: PodcastCategory;
  tags: string[];
  isPremium: boolean;
  status: PodcastStatus;
  author: Types.ObjectId;    // ref to Writer
  feedback: string | null;
  scheduledAt: Date | null;
  type: 'podcast';
}

const podcastSchema = new Schema<IPodcast>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },

    summary: {
      type: String,
      required: [true, 'Summary is required'],
      trim: true,
      maxlength: [150, 'Summary cannot exceed 150 characters'],
    },

    aboutEpisode: {
      type: String,
      required: [true, 'About this episode is required'],
    },

    coverImage: {
      type: String,
      required: [true, 'Cover image is required'],
    },

    audioFile: {
      type: String,
      required: [true, 'Audio file is required'],
    },

    // Writer manually enters duration in minutes
    audioDuration: {
      type: Number,
      required: [true, 'Audio duration is required'],
      min: [1, 'Duration must be at least 1 minute'],
    },

    category: {
      type: String,
      enum: {
        values: ['explore', 'politics', 'business', 'finance', 'technology', 'culture', 'gastronomy', 'idx'],
        message: '{VALUE} is not a valid category',
      },
      default: 'explore',
    },

    tags: {
      type: [String],
      default: [],
    },

    isPremium: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: {
        values: ['draft', 'pending', 'published', 'rejected', 'revision'],
        message: '{VALUE} is not a valid status',
      },
      default: 'draft',
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: 'Writer',
      required: [true, 'Author is required'],
    },

    feedback: { type: String, default: null },
    scheduledAt: { type: Date, default: null },

    type: {
      type: String,
      default: 'podcast',
      immutable: true,
    },
  },
  { timestamps: true }
);

export const Podcast = model<IPodcast>('Podcast', podcastSchema);