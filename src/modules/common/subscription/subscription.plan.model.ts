import { Schema, model, Document } from 'mongoose';

export type PlanType = 'monthly' | 'yearly';

export interface ISubscriptionPlan extends Document {
  planType: PlanType;
  price: number;           // display price in USD dollars
  stripePriceId: string;   // active Stripe Price ID linked to this plan
  stripeProductId: string; // Stripe Product ID (one product per plan type)
  currency: string;
  isActive: boolean;
  features: string[];
}

const subscriptionPlanSchema = new Schema<ISubscriptionPlan>(
  {
    planType: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
      unique: true,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    stripePriceId: { type: String, default: '' },
    stripeProductId: { type: String, default: '' },
    currency: { type: String, default: 'usd' },
    isActive: { type: Boolean, default: true },
    features: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const SubscriptionPlan = model<ISubscriptionPlan>('SubscriptionPlan', subscriptionPlanSchema);
