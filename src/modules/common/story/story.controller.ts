import { Request, Response, NextFunction } from 'express';
import { Story } from './story.model';
import { createError } from '../../../utils/ApiError';
import { uploadImageToS3, deleteImageFromS3 } from '../../../utils/s3.utils';

// ══════════════════════════════════════════
//  WRITER CONTROLLERS
// ══════════════════════════════════════════

// ─────────────────────────────────────────
// POST /api/story/writer/create
// Writer creates a new story — starts as draft
// form-data: title, summary, content, category, tags, isPremium, coverImage (file)
// ─────────────────────────────────────────
const createStory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, summary, content, category, tags, isPremium } = req.body;

    if (!title || !summary || !content) {
      return res.status(400).json({ success: false, message: 'Title, summary and content are required' });
    }

    // Cover image is mandatory
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Cover image is required' });
    }

    // Upload cover image to S3
    const coverImage = await uploadImageToS3(req.file.buffer, req.file.mimetype, 'story-covers');

    // Parse tags if sent as JSON string from form-data
    const parsedTags = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [];

    const story = await Story.create({
      title,
      summary,
      content,
      coverImage,
      category: category || 'explore',
      tags: parsedTags,
      isPremium: isPremium === 'true' || isPremium === true,
      author: req.writerId,
      status: 'draft', // always starts as draft
    });

    return res.status(201).json({
      success: true,
      message: 'Story created as draft',
      data: story,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/story/writer/edit/:storyId
// Writer edits their story — only allowed on draft or revision status
// form-data: any field + coverImage (file, optional)
// ─────────────────────────────────────────
const editStory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;
    const { title, summary, content, category, tags, isPremium } = req.body;

    const story = await Story.findById(storyId);
    if (!story) throw createError(404, 'Story not found');

    // Only the author can edit
    if (story.author.toString() !== req.writerId) {
      throw createError(403, 'You are not allowed to edit this story');
    }

    // Can only edit if draft or sent back for revision
    if (story.status !== 'draft' && story.status !== 'revision') {
      throw createError(400, 'You can only edit stories that are in draft or revision status');
    }

    // Handle new cover image upload
    if (req.file) {
      // Delete old cover from S3
      await deleteImageFromS3(story.coverImage);
      story.coverImage = await uploadImageToS3(req.file.buffer, req.file.mimetype, 'story-covers');
    }

    if (title) story.title = title;
    if (summary) story.summary = summary;
    if (content) story.content = content;
    if (category) story.category = category;
    if (tags) story.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
    if (isPremium !== undefined) story.isPremium = isPremium === 'true' || isPremium === true;

    await story.save();

    return res.status(200).json({
      success: true,
      message: 'Story updated successfully',
      data: story,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/story/writer/submit/:storyId
// Writer submits story to editor — status changes to pending
// ─────────────────────────────────────────
const submitStory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId);
    if (!story) throw createError(404, 'Story not found');

    if (story.author.toString() !== req.writerId) {
      throw createError(403, 'You are not allowed to submit this story');
    }

    // Can only submit draft or revision stories
    if (story.status !== 'draft' && story.status !== 'revision') {
      throw createError(400, 'Only draft or revision stories can be submitted');
    }

    story.status = 'pending';
    // Clear old feedback when resubmitting
    story.feedback = null;
    await story.save();

    return res.status(200).json({
      success: true,
      message: 'Story submitted to editor for review',
      data: { id: story._id, status: story.status },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE /api/story/writer/delete/:storyId
// Writer deletes their story — only draft can be deleted
// ─────────────────────────────────────────
const deleteStory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId);
    if (!story) throw createError(404, 'Story not found');

    if (story.author.toString() !== req.writerId) {
      throw createError(403, 'You are not allowed to delete this story');
    }

    // if (story.status !== 'draft') {
    //   throw createError(400, 'Only draft stories can be deleted');
    // }

    // Delete cover image from S3
    await deleteImageFromS3(story.coverImage);
    await Story.findByIdAndDelete(storyId);

    return res.status(200).json({
      success: true,
      message: 'Story deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/story/writer/my-stories
// Writer gets all their own stories with status info
// query: ?status=draft&page=1&limit=10
// ─────────────────────────────────────────
const getMyStories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = { author: req.writerId };

    // Filter by status if provided
    if (status) filter.status = status;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [stories, total] = await Promise.all([
      Story.find(filter)
        .select('-content') // exclude full content in list view
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Story.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: stories,
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
// GET /api/story/writer/my-stories/:storyId
// Writer gets full detail of one of their stories
// ─────────────────────────────────────────
const getMyStoryDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({
      _id: storyId,
      author: req.writerId,
    }).populate('author', 'name email profileImage');

    if (!story) throw createError(404, 'Story not found');

    return res.status(200).json({
      success: true,
      data: story,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/story/writer/scheduled
// Writer sees all their scheduled stories set by editor
// ─────────────────────────────────────────
const getScheduledStories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stories = await Story.find({
      author: req.writerId,
      scheduledAt: { $ne: null }, // only stories with a schedule date
    })
      .select('title coverImage category scheduledAt status isPremium')
      .sort({ scheduledAt: 1 }); // soonest first

    return res.status(200).json({
      success: true,
      data: stories,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/story/writer/feedback/:storyId
// Writer reads feedback sent by editor on rejection or revision
// ─────────────────────────────────────────
const getStoryFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({
      _id: storyId,
      author: req.writerId,
    }).select('title status feedback');

    if (!story) throw createError(404, 'Story not found');

    if (!story.feedback) {
      return res.status(200).json({
        success: true,
        message: 'No feedback available for this story',
        data: { feedback: null },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        title: story.title,
        status: story.status,
        feedback: story.feedback,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════
//  EDITOR CONTROLLERS
// ══════════════════════════════════════════

// ─────────────────────────────────────────
// GET /api/story/editor/pending
// Editor gets all stories waiting for review
// query: ?category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getPendingStories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = { status: 'pending' };
    if (category) filter.category = category;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [stories, total] = await Promise.all([
      Story.find(filter)
        .select('-content') // list view — no full content
        .populate('author', 'name email profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Story.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: stories,
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
// GET /api/story/editor/review/:storyId
// Editor gets full detail of a story to review
// ─────────────────────────────────────────
const getStoryForReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId)
      .populate('author', 'name email profileImage bio');

    if (!story) throw createError(404, 'Story not found');

    return res.status(200).json({
      success: true,
      data: story,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/story/editor/approve/:storyId
// Editor approves and publishes immediately
// ─────────────────────────────────────────
const approveStory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findById(storyId);
    if (!story) throw createError(404, 'Story not found');

    if (story.status !== 'pending') {
      throw createError(400, 'Only pending stories can be approved');
    }

    story.status = 'published';
    story.feedback = null;
    story.scheduledAt = null;
    await story.save();

    return res.status(200).json({
      success: true,
      message: 'Story approved and published',
      data: { id: story._id, status: story.status },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/story/editor/schedule/:storyId
// Editor approves and schedules for a future publish time
// body: { scheduledAt: "2026-04-10T08:00:00.000Z" }
// ─────────────────────────────────────────
const scheduleStory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) throw createError(400, 'scheduledAt date is required');

    const scheduleDate = new Date(scheduledAt);

    // Scheduled time must be in the future
    if (scheduleDate <= new Date()) {
      throw createError(400, 'Scheduled time must be in the future');
    }

    const story = await Story.findById(storyId);
    if (!story) throw createError(404, 'Story not found');

    if (story.status !== 'pending') {
      throw createError(400, 'Only pending stories can be scheduled');
    }

    // Status stays pending until scheduled time
    // You can add a cron job later to auto-publish at scheduledAt time
    story.scheduledAt = scheduleDate;
    story.status = 'published'; // mark published — frontend shows scheduled date
    await story.save();

    return res.status(200).json({
      success: true,
      message: `Story scheduled for ${scheduleDate.toISOString()}`,
      data: { id: story._id, status: story.status, scheduledAt: story.scheduledAt },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/story/editor/reject/:storyId
// Editor rejects story with feedback
// body: { feedback: "reason for rejection" }
// ─────────────────────────────────────────
const rejectStory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;
    const { feedback } = req.body;

    if (!feedback) throw createError(400, 'Feedback is required when rejecting a story');

    const story = await Story.findById(storyId);
    if (!story) throw createError(404, 'Story not found');

    if (story.status !== 'pending') {
      throw createError(400, 'Only pending stories can be rejected');
    }

    story.status = 'rejected';
    story.feedback = feedback;
    await story.save();

    return res.status(200).json({
      success: true,
      message: 'Story rejected with feedback',
      data: { id: story._id, status: story.status, feedback: story.feedback },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/story/editor/request-revision/:storyId
// Editor sends story back to writer for changes
// body: { feedback: "what needs to be changed" }
// ─────────────────────────────────────────
const requestRevision = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;
    const { feedback } = req.body;

    if (!feedback) throw createError(400, 'Feedback is required when requesting revision');

    const story = await Story.findById(storyId);
    if (!story) throw createError(404, 'Story not found');

    if (story.status !== 'pending') {
      throw createError(400, 'Only pending stories can be sent for revision');
    }

    story.status = 'revision';
    story.feedback = feedback;
    await story.save();

    return res.status(200).json({
      success: true,
      message: 'Story sent back to writer for revision',
      data: { id: story._id, status: story.status, feedback: story.feedback },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/story/editor/edit/:storyId
// Editor can edit story content directly before publishing
// form-data: any story field + coverImage (file, optional)
// ─────────────────────────────────────────
const editorEditStory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;
    const { title, summary, content, category, tags, isPremium } = req.body;

    const story = await Story.findById(storyId);
    if (!story) throw createError(404, 'Story not found');

    // Editor can only edit pending stories
    if (story.status !== 'pending') {
      throw createError(400, 'Editor can only edit pending stories');
    }

    // Handle new cover image
    if (req.file) {
      await deleteImageFromS3(story.coverImage);
      story.coverImage = await uploadImageToS3(req.file.buffer, req.file.mimetype, 'story-covers');
    }

    if (title) story.title = title;
    if (summary) story.summary = summary;
    if (content) story.content = content;
    if (category) story.category = category;
    if (tags) story.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
    if (isPremium !== undefined) story.isPremium = isPremium === 'true' || isPremium === true;

    await story.save();

    return res.status(200).json({
      success: true,
      message: 'Story updated by editor',
      data: story,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/story/editor/all
// Editor sees all stories — filterable by status and category
// query: ?status=pending&category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getAllStoriesForEditor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [stories, total] = await Promise.all([
      Story.find(filter)
        .select('-content')
        .populate('author', 'name email profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Story.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: stories,
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

// ══════════════════════════════════════════
//  READER CONTROLLERS
// ══════════════════════════════════════════

// ─────────────────────────────────────────
// GET /api/story/reader/all
// Reader gets all published stories — list view only (no full content)
// query: ?category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getAllStoriesForReader = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = { status: 'published' };
    if (category) filter.category = category;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [stories, total] = await Promise.all([
      Story.find(filter)
        // Only return what reader needs in list view — no full content
        .select('title summary coverImage category isPremium readingTime scheduledAt createdAt')
        .populate('author', 'name profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Story.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: stories,
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
// GET /api/story/reader/detail/:storyId
// Reader gets full story detail
// Free story → anyone can read
// Premium story → only subscribed readers
// ─────────────────────────────────────────
const getStoryDetailForReader = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { storyId } = req.params;

    const story = await Story.findOne({
      _id: storyId,
      status: 'published',
    }).populate('author', 'name profileImage bio');

    if (!story) throw createError(404, 'Story not found');

    // If premium story — check subscription
    if (story.isPremium) {
      // req.readerId is set by verifyReader middleware
      // if no readerId it means not logged in
      if (!req.readerId) {
        return res.status(403).json({
          success: false,
          message: 'Please login to read premium content',
        });
      }

      // Import Reader model to check subscription
      const { Reader } = await import('../../reader/auth/reader.model');
      const reader = await Reader.findById(req.readerId);

      if (!reader || !reader.isSubscribed) {
        return res.status(403).json({
          success: false,
          message: 'Subscribe to read premium content',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: story,
    });
  } catch (error) {
    next(error);
  }
};

export {
  // Writer
  createStory,
  editStory,
  submitStory,
  deleteStory,
  getMyStories,
  getMyStoryDetail,
  getScheduledStories,
  getStoryFeedback,
  // Editor
  getPendingStories,
  getStoryForReview,
  approveStory,
  scheduleStory,
  rejectStory,
  requestRevision,
  editorEditStory,
  getAllStoriesForEditor,
  // Reader
  getAllStoriesForReader,
  getStoryDetailForReader,
};