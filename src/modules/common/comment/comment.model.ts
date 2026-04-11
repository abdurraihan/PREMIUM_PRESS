import { Schema, model, Document, Types } from 'mongoose';

// Which type of content this comment belongs to
export type ContentType = 'story' | 'podcast' | 'liveNews';

// Who wrote the comment — reader or writer
export type CommenterRole = 'reader' | 'writer';

export interface IComment extends Document {
  content: string;
  contentType: ContentType;     // story, podcast or liveNews
  contentId: Types.ObjectId;    // the actual story/podcast/liveNews id
  author: Types.ObjectId;       // reader or writer id
  authorRole: CommenterRole;    // so we know which model to populate from
  parentComment: Types.ObjectId | null; // null = top level, id = reply
  likes: Types.ObjectId[];      // reader/writer ids who liked
  dislikes: Types.ObjectId[];   // reader/writer ids who disliked
  isDeleted: boolean;           // soft delete — keep reply thread intact
}

const commentSchema = new Schema<IComment>(
  {
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },

    // Which content type this comment is on
    contentType: {
      type: String,
      enum: {
        values: ['story', 'podcast', 'liveNews'],
        message: '{VALUE} is not a valid content type',
      },
      required: [true, 'Content type is required'],
    },

    // The id of the story/podcast/liveNews
    contentId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Content id is required'],
      refPath: 'contentType', // dynamic ref based on contentType
    },

    // The person who wrote the comment
    author: {
      type: Schema.Types.ObjectId,
      required: [true, 'Author is required'],
    },

    // reader or writer — tells us which collection to look in
    authorRole: {
      type: String,
      enum: ['reader', 'writer'],
      required: [true, 'Author role is required'],
    },

    // null means top level comment
    // objectId means this is a reply to that comment
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },

    // Array of user ids who liked this comment
    likes: {
      type: [Schema.Types.ObjectId],
      default: [],
    },

    // Array of user ids who disliked this comment
    dislikes: {
      type: [Schema.Types.ObjectId],
      default: [],
    },

    // Soft delete — when deleted we show "comment removed"
    // but replies still show in thread
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const Comment = model<IComment>('Comment', commentSchema);