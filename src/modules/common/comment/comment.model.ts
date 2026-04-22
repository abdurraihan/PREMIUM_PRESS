import { Schema, model, Document, Types } from 'mongoose';

export type ContentType = 'story' | 'podcast' | 'liveNews';
export type CommenterRole = 'reader' | 'writer';

export interface IComment extends Document {
  content: string;
  contentType: ContentType;
  contentId: Types.ObjectId;
  author: Types.ObjectId;
  authorRole: CommenterRole;
  authorModel: 'Reader' | 'Writer'; // tells mongoose which collection to populate from
  parentComment: Types.ObjectId | null;
  likes: Types.ObjectId[];
  dislikes: Types.ObjectId[];
  isDeleted: boolean;
}

const commentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },

    contentType: {
      type: String,
      enum: {
        values: ['story', 'podcast', 'liveNews'],
        message: '{VALUE} is not a valid content type',
      },
      required: [true, 'Content type is required'],
    },

    contentId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Content id is required'],
    },

    author: {
      type: Schema.Types.ObjectId,
      required: [true, 'Author is required'],
      // refPath tells mongoose — look at authorModel field
      // to know which collection to populate from
      refPath: 'authorModel',
    },

    authorRole: {
      type: String,
      enum: ['reader', 'writer'],
      required: [true, 'Author role is required'],
    },

    // 'Reader' or 'Writer' — must match exact mongoose model name
    authorModel: {
      type: String,
      required: true,
      enum: ['Reader', 'Writer'],
    },

    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },

    likes: {
      type: [Schema.Types.ObjectId],
      default: [],
    },

    dislikes: {
      type: [Schema.Types.ObjectId],
      default: [],
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Comment = model<IComment>('Comment', commentSchema);