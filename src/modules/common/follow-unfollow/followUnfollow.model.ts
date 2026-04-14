import { Schema, model, Document, Types } from 'mongoose';

export interface IFollow extends Document {
  reader: Types.ObjectId;   // the one who follows
  writer: Types.ObjectId;   // the one being followed
  createdAt: Date;
}

const followSchema = new Schema<IFollow>(
  {
    // Reader who is following
    reader: {
      type: Schema.Types.ObjectId,
      ref: 'Reader',
      required: [true, 'Reader is required'],
    },

    // Writer being followed
    writer: {
      type: Schema.Types.ObjectId,
      ref: 'Writer',
      required: [true, 'Writer is required'],
    },
  },
  { timestamps: true }
);

// One reader can only follow a writer once
// Compound unique index prevents duplicate follows
followSchema.index({ reader: 1, writer: 1 }, { unique: true });

export const Follow = model<IFollow>('Follow', followSchema);