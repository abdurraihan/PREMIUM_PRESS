import { Request, Response, NextFunction } from 'express';
import { LiveNews } from './liveNews.model';
import { createError } from '../../../utils/ApiError';

// ──────────────────────────────────────────
//  WRITER CONTROLLERS
// ──────────────────────────────────────────

// ─────────────────────────────────────────
// POST /api/live-news/writer/post
// Writer posts live news directly — no editor flow
// body: { content }
// ─────────────────────────────────────────
const postLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'News content is required' });
    }

    const news = await LiveNews.create({
      content,
      author: req.writerId,
    });

    return res.status(201).json({
      success: true,
      message: 'Live news posted successfully',
      data: news,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/live-news/writer/edit/:newsId
// Writer edits their own live news
// ─────────────────────────────────────────
const editLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newsId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const news = await LiveNews.findById(newsId);
    if (!news) throw createError(404, 'Live news not found');

    // Only the author can edit
    if (news.author.toString() !== req.writerId) {
      throw createError(403, 'You are not allowed to edit this news');
    }

    news.content = content;
    await news.save();

    return res.status(200).json({
      success: true,
      message: 'Live news updated successfully',
      data: news,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE /api/live-news/writer/delete/:newsId
// ─────────────────────────────────────────
const deleteLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newsId } = req.params;

    const news = await LiveNews.findById(newsId);
    if (!news) throw createError(404, 'Live news not found');

    if (news.author.toString() !== req.writerId) {
      throw createError(403, 'You are not allowed to delete this news');
    }

    await LiveNews.findByIdAndDelete(newsId);

    return res.status(200).json({
      success: true,
      message: 'Live news deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/live-news/writer/my-news
// Writer sees their own posts
// query: ?page=1&limit=10
// ─────────────────────────────────────────
const getMyLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [news, total] = await Promise.all([
      LiveNews.find({ author: req.writerId })
        .sort({ postedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      LiveNews.countDocuments({ author: req.writerId }),
    ]);

    return res.status(200).json({
      success: true,
      data: news,
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

// ──────────────────────────────────────────
//  READER CONTROLLER
//  Single API — list only, no detail needed
// ──────────────────────────────────────────

// ─────────────────────────────────────────
// GET /api/live-news/reader/all
// Always free — no subscription check
// Shows time like "15:07" using postedAt
// query: ?page=1&limit=20
// ─────────────────────────────────────────
const getAllLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [news, total] = await Promise.all([
      LiveNews.find()
        .populate('author', 'name profileImage')
        .sort({ postedAt: -1 }) // latest first
        .skip(skip)
        .limit(limitNum),
      LiveNews.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      data: news,
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
// GET /api/live-news/writer/my-news
// Writer sees only their own live news posts
// query: ?page=1&limit=10
// ─────────────────────────────────────────


export { postLiveNews, editLiveNews, deleteLiveNews, getMyLiveNews, getAllLiveNews };