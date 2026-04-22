import { Request, Response, NextFunction } from 'express';
import { Reader } from '../reader/auth/reader.model';
import { Writer } from '../writer/auth/writer.auth.model';
import { Editor } from '../editor/auth/editor.model';
import { Story } from '../common/story/story.model';
import { Podcast } from '../common/podcast/podcast.model';
import { LiveNews } from '../common/liveNews/liveNews.model';
import { Subscription } from '../common/subscription/subscription.model';
import { SubscriptionPlan } from '../common/subscription/subscription.plan.model';
import { Settings } from './settings.model';
import { createError } from '../../utils/ApiError';

// ──────────────────────────────────────────────────────────
//  GET /api/v1/admin/dashboard/stats
// ──────────────────────────────────────────────────────────
const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalReaders,
      totalWriters,
      totalEditors,
      activeSubscriptions,
      totalSubscriptions,
      totalStories,
      publishedStories,
      totalPodcasts,
      publishedPodcasts,
      totalLiveNews,
      publishedLiveNews,
    ] = await Promise.all([
      Reader.countDocuments(),
      Writer.countDocuments(),
      Editor.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments(),
      Story.countDocuments(),
      Story.countDocuments({ status: 'published' }),
      Podcast.countDocuments(),
      Podcast.countDocuments({ status: 'published' }),
      LiveNews.countDocuments(),
      LiveNews.countDocuments({ status: 'published' }),
    ]);

    // Calculate total earning from all subscriptions ever created
    const plans = await SubscriptionPlan.find().lean();
    const planPriceMap: Record<string, number> = {};
    for (const p of plans) planPriceMap[p.planType] = p.price;

    const allSubs = await Subscription.find().select('planType').lean();
    let totalEarning = 0;
    for (const sub of allSubs) {
      totalEarning += planPriceMap[sub.planType] || 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        users: { readers: totalReaders, writers: totalWriters, editors: totalEditors },
        subscriptions: { active: activeSubscriptions, total: totalSubscriptions, totalEarning },
        content: {
          stories: { total: totalStories, published: publishedStories },
          podcasts: { total: totalPodcasts, published: publishedPodcasts },
          liveNews: { total: totalLiveNews, published: publishedLiveNews },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────
//  GET /api/v1/admin/dashboard/users?role=reader|writer|editor&page=1&limit=10
// ──────────────────────────────────────────────────────────
const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role = 'reader', page = '1', limit = '10', search } = req.query;
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const limitNum = Math.min(parseInt(limit as string) || 10, 100);
    const skip = (pageNum - 1) * limitNum;

    let Model: any;
    if (role === 'writer') Model = Writer;
    else if (role === 'editor') Model = Editor;
    else Model = Reader;

    const filter: any = {};
    if (search) filter.name = { $regex: search, $options: 'i' };

    const [users, total] = await Promise.all([
      Model.find(filter)
        .select('-password -otp -otpExpiry -fcmToken -stripeCustomerId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Model.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────
//  GET /api/v1/admin/dashboard/users/:userId?role=reader|writer|editor
// ──────────────────────────────────────────────────────────
const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { role = 'reader' } = req.query;

    let Model: any;
    if (role === 'writer') Model = Writer;
    else if (role === 'editor') Model = Editor;
    else Model = Reader;

    const user = await Model.findById(userId).select('-password -otp -otpExpiry -fcmToken -stripeCustomerId');
    if (!user) throw createError(404, 'User not found');

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────
//  DELETE /api/v1/admin/dashboard/users/:userId?role=reader|writer|editor
// ──────────────────────────────────────────────────────────
const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { role = 'reader' } = req.query;

    let Model: any;
    if (role === 'writer') Model = Writer;
    else if (role === 'editor') Model = Editor;
    else Model = Reader;

    const user = await Model.findByIdAndDelete(userId);
    if (!user) throw createError(404, 'User not found');

    return res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────
//  GET /api/v1/admin/dashboard/archive
//  ?type=story|podcast|liveNews  ?status=  ?search=  ?page=  ?limit=
//  Returns items + summary counts for all statuses
// ──────────────────────────────────────────────────────────
const getArchive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type = 'story', status, search, page = '1', limit = '10' } = req.query;
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const limitNum = Math.min(parseInt(limit as string) || 10, 100);
    const skip = (pageNum - 1) * limitNum;

    let Model: any;
    if (type === 'podcast') Model = Podcast;
    else if (type === 'liveNews') Model = LiveNews;
    else Model = Story;

    const filter: any = {};
    if (status) filter.status = status;
    if (search) {
      filter[type === 'liveNews' ? 'content' : 'title'] = { $regex: search, $options: 'i' };
    }

    const [items, total, countTotal, countRejected, countPublished, countPending, countRevision] = await Promise.all([
      Model.find(filter)
        .populate('author', 'name email profileImage')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Model.countDocuments(filter),
      Model.countDocuments(),
      Model.countDocuments({ status: 'rejected' }),
      Model.countDocuments({ status: 'published' }),
      Model.countDocuments({ status: 'pending' }),
      Model.countDocuments({ status: 'revision' }),
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        total: countTotal,
        published: countPublished,
        pending: countPending,
        rejected: countRejected,
        revision: countRevision,
      },
      data: items,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────
//  GET /api/v1/admin/dashboard/earnings?period=monthly|yearly
//  Returns total + breakdown + chart data
// ──────────────────────────────────────────────────────────
const getEarnings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { period = 'yearly' } = req.query;

    const plans = await SubscriptionPlan.find().lean();
    const planPriceMap: Record<string, number> = {};
    for (const p of plans) planPriceMap[p.planType] = p.price;

    const now = new Date();
    const dateFilter: any = {};

    if (period === 'monthly') {
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    } else {
      // yearly — current calendar year
      dateFilter.createdAt = { $gte: new Date(now.getFullYear(), 0, 1) };
    }

    const subscriptions = await Subscription.find(dateFilter).select('planType createdAt status').lean();

    let totalRevenue = 0;
    const breakdown = { monthly: 0, yearly: 0 };
    for (const sub of subscriptions) {
      const price = planPriceMap[sub.planType] || 0;
      totalRevenue += price;
      if (sub.planType === 'monthly') breakdown.monthly += price;
      else breakdown.yearly += price;
    }

    // Build chart data
    let chartData: { label: string; revenue: number }[] = [];

    if (period === 'monthly') {
      // Daily breakdown for current month
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dailyMap: Record<number, number> = {};
      for (let d = 1; d <= daysInMonth; d++) dailyMap[d] = 0;

      for (const sub of subscriptions) {
        const day = new Date((sub as any).createdAt).getDate();
        dailyMap[day] = (dailyMap[day] || 0) + (planPriceMap[sub.planType] || 0);
      }

      chartData = Object.entries(dailyMap).map(([day, revenue]) => ({
        label: `Day ${day}`,
        revenue,
      }));
    } else {
      // Monthly breakdown for current year
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyMap: Record<number, number> = {};
      for (let m = 0; m < 12; m++) monthlyMap[m] = 0;

      for (const sub of subscriptions) {
        const month = new Date((sub as any).createdAt).getMonth();
        monthlyMap[month] = (monthlyMap[month] || 0) + (planPriceMap[sub.planType] || 0);
      }

      chartData = monthNames.map((label, i) => ({ label, revenue: monthlyMap[i] || 0 }));
    }

    return res.status(200).json({
      success: true,
      data: {
        period,
        totalRevenue,
        activeSubscribers: subscriptions.filter((s) => s.status === 'active').length,
        breakdown,
        chartData,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────
//  GET /api/v1/admin/dashboard/settings
// ──────────────────────────────────────────────────────────
const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────
//  PATCH /api/v1/admin/dashboard/settings
//  body: { aboutUs?, privacyPolicy?, termsAndConditions? }
// ──────────────────────────────────────────────────────────
const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aboutUs, privacyPolicy, termsAndConditions } = req.body;
    const updates: Record<string, any> = {};
    if (aboutUs !== undefined) updates.aboutUs = aboutUs;
    if (privacyPolicy !== undefined) updates.privacyPolicy = privacyPolicy;
    if (termsAndConditions !== undefined) updates.termsAndConditions = termsAndConditions;

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: updates },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, message: 'Settings updated', data: settings });
  } catch (error) {
    next(error);
  }
};

export { getDashboardStats, getUsers, getUserById, deleteUser, getArchive, getEarnings, getSettings, updateSettings };
