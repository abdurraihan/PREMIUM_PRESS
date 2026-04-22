import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { SubscriptionPlan } from './subscription.plan.model';
import { Subscription } from './subscription.model';
import { Reader } from '../../reader/auth/reader.model';
import { createError } from '../../../utils/ApiError';
import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  REVENUECAT_WEBHOOK_SECRET,
} from '../../../config/env';

const stripe = new Stripe(STRIPE_SECRET_KEY);

// ─────────────────────────────────────────
// POST /api/v1/subscription/confirm/stripe
//
// Called by your FRONTEND after Stripe checkout succeeds.
// Frontend passes the sessionId from the success URL (?session_id=cs_live_...)
// and the planType the reader purchased.
// Backend verifies with Stripe, records the subscription, marks reader as subscribed.
// ─────────────────────────────────────────
const confirmStripeSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, planType } = req.body;

    if (!sessionId) throw createError(400, 'sessionId is required');
    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      throw createError(400, 'planType must be "monthly" or "yearly"');
    }

    const reader = await Reader.findById(req.readerId);
    if (!reader) throw createError(404, 'Reader not found');

    // Retrieve and verify the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid') {
      throw createError(400, 'Payment has not been completed for this session');
    }

    // Make sure this session belongs to this reader (guard against session ID theft)
    if (session.customer_email && session.customer_email.toLowerCase() !== reader.email.toLowerCase()) {
      throw createError(403, 'This session does not belong to your account');
    }

    // Prevent double-recording the same session
    const alreadyRecorded = await Subscription.findOne({ stripeSessionId: sessionId });
    if (alreadyRecorded) {
      return res.status(200).json({
        success: true,
        message: 'Subscription already recorded',
        data: alreadyRecorded,
      });
    }

    const stripeSub = session.subscription as Stripe.Subscription;
    if (!stripeSub) throw createError(400, 'No subscription found in this session');

    // Record this subscription period in history
    const subscription = await Subscription.create({
      reader: reader._id,
      planType,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: stripeSub.id,
      stripeSessionId: session.id,
      status: 'active',
      currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
      currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
    });

    // Mark reader as subscribed
    reader.isSubscribed = true;
    reader.stripeCustomerId = session.customer as string;
    await reader.save();

    return res.status(200).json({
      success: true,
      message: 'Subscription activated successfully',
      data: {
        planType: subscription.planType,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/v1/subscription/confirm/revenuecat
//
// Called by your MOBILE APP after a RevenueCat purchase completes.
// The app passes purchase details; backend records them and marks reader as subscribed.
// ─────────────────────────────────────────
const confirmRevenueCatSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planType, originalTransactionId, purchasedAtMs, expirationAtMs } = req.body;

    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      throw createError(400, 'planType must be "monthly" or "yearly"');
    }
    if (!expirationAtMs) throw createError(400, 'expirationAtMs is required');

    const reader = await Reader.findById(req.readerId);
    if (!reader) throw createError(404, 'Reader not found');

    // Prevent double-recording the same transaction
    if (originalTransactionId) {
      const alreadyRecorded = await Subscription.findOne({ revenueCatTransactionId: originalTransactionId });
      if (alreadyRecorded) {
        return res.status(200).json({
          success: true,
          message: 'Subscription already recorded',
          data: alreadyRecorded,
        });
      }
    }

    const subscription = await Subscription.create({
      reader: reader._id,
      planType,
      stripeCustomerId: '',
      stripeSubscriptionId: '',
      stripeSessionId: '',
      revenueCatTransactionId: originalTransactionId || null,
      status: 'active',
      currentPeriodStart: purchasedAtMs ? new Date(purchasedAtMs) : new Date(),
      currentPeriodEnd: new Date(expirationAtMs),
      cancelAtPeriodEnd: false,
    });

    reader.isSubscribed = true;
    await reader.save();

    return res.status(200).json({
      success: true,
      message: 'Subscription activated successfully',
      data: {
        planType: subscription.planType,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/v1/subscription/status
// Active subscription + full history for this reader
// ─────────────────────────────────────────
const getSubscriptionStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reader = await Reader.findById(req.readerId).select('isSubscribed name email');
    if (!reader) throw createError(404, 'Reader not found');

    // Find the current active subscription record
    const active = await Subscription.findOne({
      reader: req.readerId,
      status: 'active',
      currentPeriodEnd: { $gt: new Date() },
    }).sort({ currentPeriodEnd: -1 });

    // Full subscription history (latest first)
    const history = await Subscription.find({ reader: req.readerId })
      .sort({ createdAt: -1 })
      .select('-__v');

    // Auto-correct isSubscribed if it's stale (webhook may have been missed)
    if (reader.isSubscribed && !active) {
      reader.isSubscribed = false;
      await reader.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        isSubscribed: reader.isSubscribed,
        active: active
          ? {
              planType: active.planType,
              status: active.status,
              currentPeriodEnd: active.currentPeriodEnd,
              cancelAtPeriodEnd: active.cancelAtPeriodEnd,
            }
          : null,
        history,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/v1/subscription/cancel
// Cancel at period end — reader keeps access until billing cycle ends
// ─────────────────────────────────────────
const cancelSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const active = await Subscription.findOne({
      reader: req.readerId,
      status: 'active',
      currentPeriodEnd: { $gt: new Date() },
    }).sort({ currentPeriodEnd: -1 });

    if (!active) throw createError(404, 'No active subscription found');
    if (active.cancelAtPeriodEnd) throw createError(400, 'Subscription is already scheduled to cancel');
    if (!active.stripeSubscriptionId) throw createError(400, 'Cannot cancel a mobile subscription from here — cancel via the app store');

    await stripe.subscriptions.update(active.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    active.cancelAtPeriodEnd = true;
    await active.save();

    return res.status(200).json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period. Your access continues until then.',
      data: { currentPeriodEnd: active.currentPeriodEnd },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// POST /api/v1/subscription/webhook/stripe
// Stripe calls this automatically on renewals, cancellations, expirations.
// rawBody is set by express.json verify in app.ts
// ─────────────────────────────────────────
const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  if (!sig) return res.status(400).json({ message: 'Missing stripe-signature header' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent((req as any).rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature error:', (err as Error).message);
    return res.status(400).json({ message: `Webhook error: ${(err as Error).message}` });
  }

  try {
    switch (event.type) {
      // Renewal: a new billing period started → create a new subscription record
      case 'invoice.payment_succeeded':
        await handleRenewal(event.data.object as Stripe.Invoice);
        break;

      // Payment failed → mark as past_due but keep isSubscribed true (grace period)
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Subscription fully canceled/expired → reader loses access
      case 'customer.subscription.deleted':
        await handleSubscriptionEnded(event.data.object as Stripe.Subscription);
        break;

      // cancel_at_period_end toggled, or other update
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handler error:', error);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

// ─────────────────────────────────────────
// POST /api/v1/subscription/webhook/revenuecat
// RevenueCat calls this for mobile subscription lifecycle events.
// Set Authorization header secret in RevenueCat dashboard.
// The mobile app sets app_user_id = reader's MongoDB _id.
// ─────────────────────────────────────────
const revenueCatWebhook = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { event } = req.body;
  if (!event || !event.app_user_id) {
    return res.status(400).json({ message: 'Invalid payload' });
  }

  const { type, app_user_id, product_id, original_transaction_id, expiration_at_ms, purchased_at_ms } = event;

  try {
    switch (type) {
      // New purchase or renewal from mobile
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION': {
        const planType: 'monthly' | 'yearly' = String(product_id).toLowerCase().includes('yearly') ? 'yearly' : 'monthly';

        // Check not already recorded
        const exists = original_transaction_id
          ? await Subscription.findOne({ revenueCatTransactionId: original_transaction_id })
          : null;

        if (!exists) {
          await Subscription.create({
            reader: app_user_id,
            planType,
            stripeCustomerId: '',
            stripeSubscriptionId: '',
            stripeSessionId: '',
            revenueCatTransactionId: original_transaction_id || null,
            status: 'active',
            currentPeriodStart: purchased_at_ms ? new Date(purchased_at_ms) : new Date(),
            currentPeriodEnd: expiration_at_ms ? new Date(expiration_at_ms) : new Date(),
            cancelAtPeriodEnd: false,
          });
        }

        await Reader.findByIdAndUpdate(app_user_id, { isSubscribed: true });
        break;
      }

      // Canceled — reader keeps access until period end
      case 'CANCELLATION': {
        await Subscription.findOneAndUpdate(
          { reader: app_user_id, status: 'active' },
          { cancelAtPeriodEnd: true },
          { sort: { currentPeriodEnd: -1 } }
        );
        break;
      }

      // Period expired — reader loses access
      case 'EXPIRATION': {
        await Subscription.updateMany(
          { reader: app_user_id, status: 'active' },
          { status: 'expired' }
        );
        await Reader.findByIdAndUpdate(app_user_id, { isSubscribed: false });
        break;
      }

      case 'BILLING_ISSUE': {
        await Subscription.findOneAndUpdate(
          { reader: app_user_id, status: 'active' },
          { status: 'past_due' },
          { sort: { currentPeriodEnd: -1 } }
        );
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('RevenueCat webhook error:', error);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

// ─────────────────────────────────────────
// Internal Stripe event handlers
// ─────────────────────────────────────────
const handleRenewal = async (invoice: Stripe.Invoice) => {
  // Only process subscription invoices (not one-time charges)
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription as any)?.id;
  if (!subscriptionId) return;

  // Only create a new record for renewal invoices, not for the initial payment
  // (initial payment is confirmed via POST /confirm/stripe by the frontend)
  if ((invoice as any).billing_reason !== 'subscription_cycle') return;

  const customerId = invoice.customer as string;
  const reader = await Reader.findOne({ stripeCustomerId: customerId });
  if (!reader) return;

  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const existingRecord = await Subscription.findOne({ stripeSubscriptionId: subscriptionId });
  const planType: 'monthly' | 'yearly' = existingRecord?.planType || 'monthly';

  // Create a new subscription record for this renewal period
  await Subscription.create({
    reader: reader._id,
    planType,
    stripeCustomerId: customerId,
    stripeSubscriptionId: stripeSub.id,
    stripeSessionId: '',
    status: 'active',
    currentPeriodStart: new Date((stripeSub as any).current_period_start * 1000),
    currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
    cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
  });

  await Reader.findByIdAndUpdate(reader._id, { isSubscribed: true });
};

const handlePaymentFailed = async (invoice: Stripe.Invoice) => {
  const customerId = invoice.customer as string;
  const reader = await Reader.findOne({ stripeCustomerId: customerId });
  if (!reader) return;

  await Subscription.findOneAndUpdate(
    { reader: reader._id, status: 'active' },
    { status: 'past_due' },
    { sort: { currentPeriodEnd: -1 } }
  );
};

const handleSubscriptionUpdated = async (stripeSub: Stripe.Subscription) => {
  const record = await Subscription.findOne({
    stripeSubscriptionId: stripeSub.id,
    status: { $in: ['active', 'past_due'] },
  }).sort({ currentPeriodEnd: -1 });

  if (!record) return;

  record.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
  record.currentPeriodEnd = new Date((stripeSub as any).current_period_end * 1000);

  const isNowActive = stripeSub.status === 'active';
  record.status = stripeSub.status as any;
  await record.save();

  await Reader.findByIdAndUpdate(record.reader, { isSubscribed: isNowActive });
};

const handleSubscriptionEnded = async (stripeSub: Stripe.Subscription) => {
  // Mark all records with this subscription ID as expired
  await Subscription.updateMany(
    { stripeSubscriptionId: stripeSub.id, status: { $in: ['active', 'past_due'] } },
    { status: 'expired' }
  );

  // Find the reader via stripeCustomerId and revoke access
  const reader = await Reader.findOne({ stripeCustomerId: stripeSub.customer as string });
  if (!reader) return;

  // Only revoke if there's truly no other active subscription (e.g. they may have upgraded)
  const stillActive = await Subscription.findOne({
    reader: reader._id,
    status: 'active',
    currentPeriodEnd: { $gt: new Date() },
  });

  if (!stillActive) {
    await Reader.findByIdAndUpdate(reader._id, { isSubscribed: false });
  }
};

export {
  confirmStripeSubscription,
  confirmRevenueCatSubscription,
  getSubscriptionStatus,
  cancelSubscription,
  stripeWebhook,
  revenueCatWebhook,
};
