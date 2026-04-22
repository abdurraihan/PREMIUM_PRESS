import { Schema, model, Document, Types } from 'mongoose';

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'incomplete'
  | 'expired';

export interface ISubscription extends Document {
  reader: Types.ObjectId;
  planType: 'monthly' | 'yearly';
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeSessionId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  revenueCatTransactionId: string | null;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    reader: {
      type: Schema.Types.ObjectId,
      ref: 'Reader',
      required: true,
      // No unique — each billing period creates a new record (subscription history)
    },
    planType: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
    },
    stripeCustomerId: { type: String, default: '' },
    stripeSubscriptionId: { type: String, default: '' },
    stripeSessionId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete', 'expired'],
      default: 'active',
    },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    revenueCatTransactionId: { type: String, default: null },
  },
  { timestamps: true }
);

// Index for fast lookups: find active subscription for a reader
subscriptionSchema.index({ reader: 1, status: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });

export const Subscription = model<ISubscription>('Subscription', subscriptionSchema);
