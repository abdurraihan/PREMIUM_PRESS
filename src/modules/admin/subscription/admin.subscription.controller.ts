import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { SubscriptionPlan } from '../../common/subscription/subscription.plan.model';
import { Subscription } from '../../common/subscription/subscription.model';
import { createError } from '../../../utils/ApiError';
import { STRIPE_SECRET_KEY } from '../../../config/env';

const stripe = new Stripe(STRIPE_SECRET_KEY);

// ─────────────────────────────────────────
// GET /api/v1/admin/subscription/plans
// Returns both plan configs (monthly + yearly)
// ─────────────────────────────────────────
const getPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ planType: 1 });
    return res.status(200).json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/v1/admin/subscription/plans/:planType
// Admin edits price and/or features.
// When price changes → creates new Stripe Price, archives old one.
// ─────────────────────────────────────────
const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const planType = req.params.planType as string;
    if (!['monthly', 'yearly'].includes(planType)) {
      throw createError(400, 'planType must be "monthly" or "yearly"');
    }

    const { price, features, isActive } = req.body;

    let plan = await SubscriptionPlan.findOne({ planType });

    // First-time setup — create the plan document
    if (!plan) {
      if (price === undefined) throw createError(400, 'price is required when creating a plan for the first time');
      plan = new SubscriptionPlan({
        planType,
        price,
        features: features || [],
        isActive: isActive !== undefined ? isActive : true,
      });
    }

    const priceChanged = price !== undefined && Number(price) !== plan.price;

    if (priceChanged) {
      // Create Stripe Product if this plan has never been set up
      let productId = plan.stripeProductId;
      if (!productId) {
        const planLabel = planType === 'monthly' ? 'Monthly' : 'Yearly';
        const product = await stripe.products.create({
          name: `PremiumPress ${planLabel} Subscription`,
          description: `Full access to all premium stories and podcasts — ${planLabel} billing`,
          metadata: { planType },
        });
        productId = product.id;
        plan.stripeProductId = productId;
      }

      // Archive the current price so existing subscribers are unaffected
      if (plan.stripePriceId) {
        await stripe.prices.update(plan.stripePriceId, { active: false }).catch(() => {
          // Non-fatal — price may already be inactive
        });
      }

      // Create the new Stripe Price
      const stripePrice = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(Number(price) * 100), // dollars → cents
        currency: 'usd',
        recurring: {
          interval: planType === 'monthly' ? 'month' : 'year',
        },
        metadata: { planType },
      });

      plan.stripePriceId = stripePrice.id;
      plan.price = Number(price);
    }

    if (features !== undefined) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();

    return res.status(200).json({
      success: true,
      message: `${planType} subscription plan updated successfully`,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/v1/admin/subscription/subscribers
// Paginated list of all active subscribers
// ─────────────────────────────────────────
const getSubscribers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const statusFilter = (req.query.status as string) || 'active';

    const [subscriptions, total] = await Promise.all([
      Subscription.find({ status: statusFilter })
        .populate('reader', 'name email profileImage createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Subscription.countDocuments({ status: statusFilter }),
    ]);

    return res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/v1/admin/subscription/stats
// Dashboard numbers: total subscribers, MRR, breakdown by plan
// ─────────────────────────────────────────
const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalActive,
      totalCanceled,
      totalPastDue,
      monthlyCount,
      yearlyCount,
      plans,
    ] = await Promise.all([
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'canceled' }),
      Subscription.countDocuments({ status: 'past_due' }),
      Subscription.countDocuments({ status: 'active', planType: 'monthly' }),
      Subscription.countDocuments({ status: 'active', planType: 'yearly' }),
      SubscriptionPlan.find(),
    ]);

    const monthlyPlan = plans.find(p => p.planType === 'monthly');
    const yearlyPlan = plans.find(p => p.planType === 'yearly');

    // Estimated Monthly Recurring Revenue
    const estimatedMRR =
      monthlyCount * (monthlyPlan?.price || 0) +
      yearlyCount * ((yearlyPlan?.price || 0) / 12);

    return res.status(200).json({
      success: true,
      data: {
        totalActive,
        totalCanceled,
        totalPastDue,
        monthlySubscribers: monthlyCount,
        yearlySubscribers: yearlyCount,
        estimatedMRR: Math.round(estimatedMRR * 100) / 100,
        plans: {
          monthly: monthlyPlan
            ? { price: monthlyPlan.price, stripePriceId: monthlyPlan.stripePriceId, isActive: monthlyPlan.isActive }
            : null,
          yearly: yearlyPlan
            ? { price: yearlyPlan.price, stripePriceId: yearlyPlan.stripePriceId, isActive: yearlyPlan.isActive }
            : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export { getPlans, updatePlan, getSubscribers, getStats };
