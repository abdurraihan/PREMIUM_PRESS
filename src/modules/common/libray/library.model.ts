import { Schema, model, Document, Types } from 'mongoose';

export type LibraryType = 'saved' | 'readLater';
export type ContentType = 'story' | 'podcast';

export interface ILibrary extends Document {
    reader: Types.ObjectId;
    contentType: ContentType;
    contentId: Types.ObjectId;
    listType: LibraryType; // saved or readLater
    createdAt: Date;
    updatedAt: Date;
}

const librarySchema = new Schema<ILibrary>(
    {
        reader: {
            type: Schema.Types.ObjectId,
            ref: 'Reader',
            required: [true, 'Reader is required'],
        },

        // story or podcast
        contentType: {
            type: String,
            enum: {
                values: ['story', 'podcast'],
                message: '{VALUE} is not valid. Must be story or podcast',
            },
            required: [true, 'Content type is required'],
        },

        contentId: {
            type: Schema.Types.ObjectId,
            required: [true, 'Content id is required'],
        },

        // Which list — saved or readLater
        listType: {
            type: String,
            enum: {
                values: ['saved', 'readLater'],
                message: '{VALUE} is not valid. Must be saved or readLater',
            },
            required: [true, 'List type is required'],
        },
    },
    { timestamps: true }
);

// One reader can only save the same content once per list
// reader + contentId + listType must be unique together
librarySchema.index({ reader: 1, contentId: 1, listType: 1 }, { unique: true });

export const Library = model<ILibrary>('Library', librarySchema);