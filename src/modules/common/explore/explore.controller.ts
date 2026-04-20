import { Request, Response, NextFunction } from 'express';
import { Story } from '../story/story.model';
import { Podcast } from '../podcast/podcast.model';
import { Writer } from '../../writer/auth/writer.auth.model';
import { Follow } from '../follow-unfollow/followUnfollow.model';
import { React } from '../react/react.model';
import { createError } from '../../../utils/ApiError';

// ─────────────────────────────────────────
// GET /api/explore/top-stories
// Top stories sorted by total reactions count
// query: ?category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getTopStories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = { status: 'published' };
    if (category) filter.category = category;

    // Get published stories
    const [stories, total] = await Promise.all([
      Story.find(filter)
        .select('title summary coverImage category isPremium readingTime author createdAt')
        .populate('author', 'name profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Story.countDocuments(filter),
    ]);

    // Get reaction count for each story
    const storiesWithReactions = await Promise.all(
      stories.map(async (story) => {
        const reactionCount = await React.countDocuments({
          contentType: 'story',
          contentId: story._id,
        });
        return { ...story.toObject(), reactionCount };
      })
    );

    // Sort by most reactions
    storiesWithReactions.sort((a, b) => b.reactionCount - a.reactionCount);

    return res.status(200).json({
      success: true,
      data: storiesWithReactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/explore/top-podcasts
// Top podcasts sorted by total reactions count
// query: ?category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getTopPodcasts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: Record<string, any> = { status: 'published' };
    if (category) filter.category = category;

    const [podcasts, total] = await Promise.all([
      Podcast.find(filter)
        .select('title summary coverImage category isPremium audioDuration author createdAt')
        .populate('author', 'name profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Podcast.countDocuments(filter),
    ]);

    // Get reaction count for each podcast
    const podcastsWithReactions = await Promise.all(
      podcasts.map(async (podcast) => {
        const reactionCount = await React.countDocuments({
          contentType: 'podcast',
          contentId: podcast._id,
        });
        return { ...podcast.toObject(), reactionCount };
      })
    );

    // Sort by most reactions
    podcastsWithReactions.sort((a, b) => b.reactionCount - a.reactionCount);

    return res.status(200).json({
      success: true,
      data: podcastsWithReactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/explore/writer/:writerId
// Public writer profile with their published stories and podcasts
// Also shows follow status if reader is logged in
// query: ?page=1&limit=10
// ─────────────────────────────────────────
const getWriterProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { writerId } = req.params;
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get writer details
    const writer = await Writer.findById(writerId)
      .select('name profileImage bio followersCount createdAt');

    if (!writer) throw createError(404, 'Writer not found');

    // Get all published stories and podcasts together
    const [stories, podcasts, totalStories, totalPodcasts] = await Promise.all([
      Story.find({ author: writerId, status: 'published' })
        .select('title summary coverImage category isPremium readingTime createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),

      Podcast.find({ author: writerId, status: 'published' })
        .select('title summary coverImage category isPremium audioDuration createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),

      Story.countDocuments({ author: writerId, status: 'published' }),
      Podcast.countDocuments({ author: writerId, status: 'published' }),
    ]);

    // Check if current reader follows this writer — only if logged in
    let isFollowing = false;
    if (req.readerId) {
      const follow = await Follow.findOne({
        reader: req.readerId,
        writer: writerId,
      });
      isFollowing = !!follow;
    }

    return res.status(200).json({
      success: true,
      data: {
        writer: {
          ...writer.toObject(),
          isFollowing,             // button state for frontend
          totalStories,
          totalPodcasts,
          totalContent: totalStories + totalPodcasts,
        },
        stories: {
          data: stories,
          total: totalStories,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalStories / limitNum),
        },
        podcasts: {
          data: podcasts,
          total: totalPodcasts,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalPodcasts / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export { getTopStories, getTopPodcasts, getWriterProfile };