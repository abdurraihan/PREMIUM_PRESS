import { Request, Response, NextFunction } from 'express';
import { LiveNews } from './liveNews.model';
import { Editor } from '../../editor/auth/editor.model';
import { Writer } from '../../writer/auth/writer.auth.model';
import { createError } from '../../../utils/ApiError';
import { sendNotification, notifyAllFollowers } from '../../../utils/notification.utils';

// ══════════════════════════════════════════════════════
//  WRITER CONTROLLERS
// ══════════════════════════════════════════════════════

// POST /api/v1/live-news/writer/post — creates as draft
const postLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Content is required' });

    const news = await LiveNews.create({ content, author: req.writerId, status: 'draft' });

    return res.status(201).json({ success: true, message: 'Live news created as draft', data: news });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/live-news/writer/submit/:newsId — draft | revision → pending
const submitLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newsId } = req.params;

    const news = await LiveNews.findById(newsId);
    if (!news) throw createError(404, 'Live news not found');
    if (news.author.toString() !== req.writerId) throw createError(403, 'Not allowed');
    if (news.status !== 'draft' && news.status !== 'revision') {
      throw createError(400, 'Only draft or revision can be submitted');
    }

    news.status = 'pending';
    news.feedback = null;
    await news.save();

    // Notify all editors
    const editors = await Editor.find().select('_id');
    for (const editor of editors) {
      await sendNotification({
        receiver: editor._id as any,
        receiverRole: 'editor',
        type: 'new_liveNews_pending',
        message: 'New live news submitted for review',
        contentType: 'liveNews',
        contentId: news._id as any,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Submitted to editor for review',
      data: { id: news._id, status: news.status },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/live-news/writer/edit/:newsId — only draft or revision
const editLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newsId } = req.params;
    const { content } = req.body;
    if (!content) throw createError(400, 'Content is required');

    const news = await LiveNews.findById(newsId);
    if (!news) throw createError(404, 'Live news not found');
    if (news.author.toString() !== req.writerId) throw createError(403, 'Not allowed');
    if (news.status !== 'draft' && news.status !== 'revision') {
      throw createError(400, 'Can only edit draft or revision news');
    }

    news.content = content;
    await news.save();

    return res.status(200).json({ success: true, message: 'Updated successfully', data: news });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/live-news/writer/delete/:newsId — only draft
const deleteLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newsId } = req.params;

    const news = await LiveNews.findById(newsId);
    if (!news) throw createError(404, 'Live news not found');
    if (news.author.toString() !== req.writerId) throw createError(403, 'Not allowed');
    if (news.status !== 'draft') throw createError(400, 'Only draft news can be deleted');

    await LiveNews.findByIdAndDelete(newsId);

    return res.status(200).json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/live-news/writer/my-news — with optional status filter, paginated
const getMyLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = { author: req.writerId };
    if (status) filter.status = status;

    const [news, total] = await Promise.all([
      LiveNews.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      LiveNews.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: news,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/live-news/writer/my-news/:newsId
const getMyLiveNewsDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const news = await LiveNews.findOne({ _id: req.params.newsId, author: req.writerId });
    if (!news) throw createError(404, 'Not found');

    return res.status(200).json({ success: true, data: news });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════
//  EDITOR CONTROLLERS
// ══════════════════════════════════════════════════════

// GET /api/v1/live-news/editor/all — filter by status, paginated
const getAllLiveNewsForEditor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};
    if (status) filter.status = status;

    const [news, total] = await Promise.all([
      LiveNews.find(filter)
        .populate('author', 'name email profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      LiveNews.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: news,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/live-news/editor/pending
const getPendingLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [news, total] = await Promise.all([
      LiveNews.find({ status: 'pending' })
        .populate('author', 'name email profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      LiveNews.countDocuments({ status: 'pending' }),
    ]);

    return res.status(200).json({
      success: true,
      data: news,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/live-news/editor/review/:newsId
const getLiveNewsForReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const news = await LiveNews.findById(req.params.newsId)
      .populate('author', 'name email profileImage bio');
    if (!news) throw createError(404, 'Not found');

    return res.status(200).json({ success: true, data: news });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/live-news/editor/approve/:newsId
const approveLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const news = await LiveNews.findById(req.params.newsId);
    if (!news) throw createError(404, 'Not found');
    if (news.status !== 'pending') throw createError(400, 'Only pending news can be approved');

    news.status = 'published';
    news.feedback = null;
    news.scheduledAt = null;
    await news.save();

    const writer = await Writer.findById(news.author).select('name');

    await sendNotification({
      receiver: news.author,
      receiverRole: 'writer',
      type: 'liveNews_approved',
      message: 'Your live news has been approved and published',
      contentType: 'liveNews',
      contentId: news._id as any,
    });

    if (writer) {
      await notifyAllFollowers({
        writerId: news.author.toString(),
        writerName: writer.name,
        type: 'new_liveNews',
        message: `${writer.name} posted new live news`,
        contentType: 'liveNews',
        contentId: (news._id as any).toString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Approved and published',
      data: { id: news._id, status: news.status },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/live-news/editor/schedule/:newsId — body: { scheduledAt }
const scheduleLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scheduledAt } = req.body;
    if (!scheduledAt) throw createError(400, 'scheduledAt is required');

    const scheduleDate = new Date(scheduledAt);
    if (scheduleDate <= new Date()) throw createError(400, 'Scheduled time must be in the future');

    const news = await LiveNews.findById(req.params.newsId);
    if (!news) throw createError(404, 'Not found');
    if (news.status !== 'pending') throw createError(400, 'Only pending news can be scheduled');

    news.status = 'published';
    news.scheduledAt = scheduleDate;
    await news.save();

    return res.status(200).json({
      success: true,
      message: `Scheduled for ${scheduleDate.toISOString()}`,
      data: { id: news._id, status: news.status, scheduledAt: news.scheduledAt },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/live-news/editor/reject/:newsId — body: { feedback }
const rejectLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedback } = req.body;
    if (!feedback) throw createError(400, 'Feedback is required');

    const news = await LiveNews.findById(req.params.newsId);
    if (!news) throw createError(404, 'Not found');
    if (news.status !== 'pending') throw createError(400, 'Only pending news can be rejected');

    news.status = 'rejected';
    news.feedback = feedback;
    await news.save();

    await sendNotification({
      receiver: news.author,
      receiverRole: 'writer',
      type: 'liveNews_rejected',
      message: 'Your live news was rejected. Check the feedback.',
      contentType: 'liveNews',
      contentId: news._id as any,
    });

    return res.status(200).json({
      success: true,
      message: 'Rejected with feedback',
      data: { id: news._id, status: news.status, feedback: news.feedback },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/live-news/editor/request-revision/:newsId — body: { feedback }
const requestLiveNewsRevision = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { feedback } = req.body;
    if (!feedback) throw createError(400, 'Feedback is required');

    const news = await LiveNews.findById(req.params.newsId);
    if (!news) throw createError(404, 'Not found');
    if (news.status !== 'pending') throw createError(400, 'Only pending news can be sent for revision');

    news.status = 'revision';
    news.feedback = feedback;
    await news.save();

    await sendNotification({
      receiver: news.author,
      receiverRole: 'writer',
      type: 'liveNews_revision',
      message: 'Your live news needs revision. Check the feedback.',
      contentType: 'liveNews',
      contentId: news._id as any,
    });

    return res.status(200).json({
      success: true,
      message: 'Sent for revision',
      data: { id: news._id, status: news.status, feedback: news.feedback },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/live-news/editor/edit/:newsId
const editorEditLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;

    const news = await LiveNews.findById(req.params.newsId);
    if (!news) throw createError(404, 'Not found');
    if (news.status !== 'pending') throw createError(400, 'Editor can only edit pending news');

    if (content) news.content = content;
    await news.save();

    return res.status(200).json({ success: true, message: 'Updated by editor', data: news });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════
//  READER CONTROLLER
// ══════════════════════════════════════════════════════

// GET /api/v1/live-news/reader/all — published only, paginated
const getAllLiveNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [news, total] = await Promise.all([
      LiveNews.find({ status: 'published' })
        .populate('author', 'name profileImage')
        .sort({ postedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      LiveNews.countDocuments({ status: 'published' }),
    ]);

    return res.status(200).json({
      success: true,
      data: news,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

export {
  postLiveNews, submitLiveNews, editLiveNews, deleteLiveNews, getMyLiveNews, getMyLiveNewsDetail,
  getAllLiveNewsForEditor, getPendingLiveNews, getLiveNewsForReview,
  approveLiveNews, scheduleLiveNews, rejectLiveNews, requestLiveNewsRevision, editorEditLiveNews,
  getAllLiveNews,
};
