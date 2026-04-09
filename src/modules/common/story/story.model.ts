import { Schema, model, Document, Types } from 'mongoose';

// Story status flow:
// Writer creates → draft
// Writer submits → pending (goes to editor)
// Editor approves → published
// Editor rejects → rejected
// Editor requests changes → revision
export type StoryStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'revision';

export type StoryCategory =
  | 'explore'
  | 'politics'
  | 'business'
  | 'finance'
  | 'technology'
  | 'culture'
  | 'gastronomy'
  | 'idx';

export interface IStory extends Document {
  title: string;
  summary: string;
  content: string;           // full story — no limit
  coverImage: string;
  category: StoryCategory;
  tags: string[];
  isPremium: boolean;
  status: StoryStatus;
  author: Types.ObjectId;    // ref to Writer
  feedback: string | null;   // feedback from editor on rejection/revision
  scheduledAt: Date | null;  // editor can schedule publish time
  readingTime: number;       // calculated from content word count
  type: 'story';
}

const storySchema = new Schema<IStory>(
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
      maxlength: [500, 'Summary cannot exceed 500 characters'],
    },

    content: {
      type: String,
      required: [true, 'Story content is required'],
    },

    coverImage: {
      type: String,
      required: [true, 'Cover image is required'],
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

    // Ref to Writer model
    author: {
      type: Schema.Types.ObjectId,
      ref: 'Writer',
      required: [true, 'Author is required'],
    },

    // Editor sends feedback when rejecting or requesting revision
    feedback: {
      type: String,
      default: null,
    },

    // Editor can schedule when the story goes live
    scheduledAt: {
      type: Date,
      default: null,
    },

    // Auto calculated — words per minute average is 200
    readingTime: {
      type: Number,
      default: 0,
    },

    type: {
      type: String,
      default: 'story',
      immutable: true, // can never be changed after creation
    },
  },
  { timestamps: true }
);

// Auto calculate reading time before saving
// Average reading speed = 200 words per minute
storySchema.pre('save', async function () {
  if (this.isModified('content')) {
    const wordCount = this.content.trim().split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / 200);
  }
});
export const Story = model<IStory>('Story', storySchema);