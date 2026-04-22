import { Schema, model, Document } from 'mongoose';

export interface ISettings extends Document {
  aboutUs: string;
  privacyPolicy: string;
  termsAndConditions: string;
}

const settingsSchema = new Schema<ISettings>(
  {
    aboutUs: { type: String, default: '' },
    privacyPolicy: { type: String, default: '' },
    termsAndConditions: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Settings = model<ISettings>('Settings', settingsSchema);
