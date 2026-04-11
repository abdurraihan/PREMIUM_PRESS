import { Schema, model, Document, Types } from 'mongoose';

export type ContentType = 'story' | 'podcast' | 'liveNews';
export type ReactorRole = 'reader' | 'writer';
export type ReactionType = 'like' | 'love' | 'wow' | 'sad' | 'angry';

export interface IReact extends Document {
  contentType: ContentType;
  contentId: Types.ObjectId;
  reactor: Types.ObjectId;       // reader or writer id
  reactorRole: ReactorRole;
  reactionType: ReactionType;    // like, love, wow, sad, angry
}

const reactSchema = new Schema<IReact>(
  {
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

    reactor: {
      type: Schema.Types.ObjectId,
      required: [true, 'Reactor is required'],
    },

    reactorRole: {
      type: String,
      enum: ['reader', 'writer'],
      required: [true, 'Reactor role is required'],
    },

    // The type of reaction
    reactionType: {
      type: String,
      enum: {
        values: ['like', 'love', 'wow', 'sad', 'angry'],
        message: '{VALUE} is not a valid reaction type',
      },
      required: [true, 'Reaction type is required'],
    },
  },
  { timestamps: true }
);

// One person can only have one reaction per content
// compound unique index prevents duplicate reactions
reactSchema.index({ contentId: 1, reactor: 1 }, { unique: true });

export const React = model<IReact>('React', reactSchema);