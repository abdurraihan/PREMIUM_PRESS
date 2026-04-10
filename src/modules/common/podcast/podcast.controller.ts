import { Request, Response, NextFunction } from 'express';
import { Podcast } from './podcast.model';
import { createError } from '../../../utils/ApiError';
import { uploadImageToS3, uploadAudioToS3, deleteImageFromS3, deleteFileFromS3 } from '../../../utils/s3.utils';

interface PodcastFiles {
  audioFile?: Express.Multer.File[];
  coverImage?: Express.Multer.File[];
}

// ══════════════════════════════════════════
//  WRITER CONTROLLERS
// ══════════════════════════════════════════

// ─────────────────────────────────────────
// POST /api/podcast/writer/create
// form-data: title, summary, aboutEpisode, audioDuration,
//            category, tags, isPremium, audioFile, coverImage
// ─────────────────────────────────────────
const createPodcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, summary, aboutEpisode, audioDuration, category, tags, isPremium } = req.body;

    if (!title || !summary || !aboutEpisode || !audioDuration) {
      return res.status(400).json({
        success: false,
        message: 'Title, summary, about episode and audio duration are required',
      });
    }

    const files = req.files as PodcastFiles;

    if (!files?.audioFile?.[0]) {
      return res.status(400).json({ success: false, message: 'Audio file is required' });
    }
    if (!files?.coverImage?.[0]) {
      return res.status(400).json({ success: false, message: 'Cover image is required' });
    }

    // Upload both files to S3 at the same time
    const [audioUrl, coverUrl] = await Promise.all([
      uploadAudioToS3(files.audioFile[0].buffer, files.audioFile[0].mimetype, 'podcast-audio'),
      uploadImageToS3(files.coverImage[0].buffer, files.coverImage[0].mimetype, 'podcast-covers'),
    ]);

    const parsedTags = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [];

    const podcast = await Podcast.create({
      title,
      summary,
      aboutEpisode,
      audioDuration: Number(audioDuration),
      coverImage: coverUrl,
      audioFile: audioUrl,
      category: category || 'explore',
      tags: parsedTags,
      isPremium: isPremium === 'true' || isPremium === true,
      author: req.writerId,
      status: 'draft',
    });

    return res.status(201).json({
      success: true,
      message: 'Podcast created as draft',
      data: podcast,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/podcast/writer/edit/:podcastId
// Only allowed on draft or revision status
// form-data: any field + audioFile/coverImage (optional)
// ─────────────────────────────────────────
const editPodcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;
    const { title, summary, aboutEpisode, audioDuration, category, tags, isPremium } = req.body;

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw createError(404, 'Podcast not found');

    if (podcast.author.toString() !== req.writerId) {
      throw createError(403, 'You are not allowed to edit this podcast');
    }

    if (podcast.status !== 'draft' && podcast.status !== 'revision') {
      throw createError(400, 'You can only edit podcasts in draft or revision status');
    }

    const files = req.files as PodcastFiles;

    // Replace audio if new one uploaded
    if (files?.audioFile?.[0]) {
      await deleteFileFromS3(podcast.audioFile);
      podcast.audioFile = await uploadAudioToS3(
        files.audioFile[0].buffer,
        files.audioFile[0].mimetype,
        'podcast-audio'
      );
    }

    // Replace cover if new one uploaded
    if (files?.coverImage?.[0]) {
      await deleteImageFromS3(podcast.coverImage);
      podcast.coverImage = await uploadImageToS3(
        files.coverImage[0].buffer,
        files.coverImage[0].mimetype,
        'podcast-covers'
      );
    }

    if (title) podcast.title = title;
    if (summary) podcast.summary = summary;
    if (aboutEpisode) podcast.aboutEpisode = aboutEpisode;
    if (audioDuration) podcast.audioDuration = Number(audioDuration);
    if (category) podcast.category = category;
    if (tags) podcast.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
    if (isPremium !== undefined) podcast.isPremium = isPremium === 'true' || isPremium === true;

    await podcast.save();

    return res.status(200).json({
      success: true,
      message: 'Podcast updated successfully',
      data: podcast,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/podcast/writer/submit/:podcastId
// Writer submits to editor — status → pending
// ─────────────────────────────────────────
const submitPodcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw createError(404, 'Podcast not found');

    if (podcast.author.toString() !== req.writerId) {
      throw createError(403, 'You are not allowed to submit this podcast');
    }

    if (podcast.status !== 'draft' && podcast.status !== 'revision') {
      throw createError(400, 'Only draft or revision podcasts can be submitted');
    }

    podcast.status = 'pending';
    podcast.feedback = null;
    await podcast.save();

    return res.status(200).json({
      success: true,
      message: 'Podcast submitted to editor for review',
      data: { id: podcast._id, status: podcast.status },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE /api/podcast/writer/delete/:podcastId
// Only draft podcasts can be deleted
// ─────────────────────────────────────────
const deletePodcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw createError(404, 'Podcast not found');

    if (podcast.author.toString() !== req.writerId) {
      throw createError(403, 'You are not allowed to delete this podcast');
    }

    if (podcast.status !== 'draft') {
      throw createError(400, 'Only draft podcasts can be deleted');
    }

    // Delete both audio and cover from S3
    await Promise.all([
      deleteFileFromS3(podcast.audioFile),
      deleteImageFromS3(podcast.coverImage),
    ]);

    await Podcast.findByIdAndDelete(podcastId);

    return res.status(200).json({
      success: true,
      message: 'Podcast deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/podcast/writer/my-podcasts
// Writer gets all their own podcasts
// query: ?status=draft&category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getMyPodcasts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = { author: req.writerId };
    if (status) filter.status = status;
    if (category) filter.category = category;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [podcasts, total] = await Promise.all([
      Podcast.find(filter)
        // No audioFile in list — only needed in detail
        .select('-audioFile -aboutEpisode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Podcast.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: podcasts,
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
// GET /api/podcast/writer/my-podcasts/:podcastId
// Writer gets full detail of one podcast including audioFile
// ─────────────────────────────────────────
const getMyPodcastDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;

    const podcast = await Podcast.findOne({
      _id: podcastId,
      author: req.writerId,
    }).populate('author', 'name email profileImage');

    if (!podcast) throw createError(404, 'Podcast not found');

    return res.status(200).json({
      success: true,
      data: podcast,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/podcast/writer/scheduled
// Writer sees their scheduled podcasts set by editor
// ─────────────────────────────────────────
const getScheduledPodcasts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const podcasts = await Podcast.find({
      author: req.writerId,
      scheduledAt: { $ne: null },
    })
      .select('title coverImage category scheduledAt status isPremium audioDuration')
      .sort({ scheduledAt: 1 }); // soonest first

    return res.status(200).json({
      success: true,
      data: podcasts,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/podcast/writer/feedback/:podcastId
// Writer reads feedback from editor
// ─────────────────────────────────────────
const getPodcastFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;

    const podcast = await Podcast.findOne({
      _id: podcastId,
      author: req.writerId,
    }).select('title status feedback');

    if (!podcast) throw createError(404, 'Podcast not found');

    return res.status(200).json({
      success: true,
      data: {
        title: podcast.title,
        status: podcast.status,
        feedback: podcast.feedback || 'No feedback available',
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
// GET /api/podcast/editor/all
// Editor sees all podcasts — filterable by status and category
// query: ?status=pending&category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getAllPodcastsForEditor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [podcasts, total] = await Promise.all([
      Podcast.find(filter)
        .select('-audioFile -aboutEpisode')
        .populate('author', 'name email profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Podcast.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: podcasts,
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
// GET /api/podcast/editor/pending
// Editor gets only pending podcasts
// query: ?category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getPendingPodcasts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = { status: 'pending' };
    if (category) filter.category = category;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [podcasts, total] = await Promise.all([
      Podcast.find(filter)
        .select('-audioFile -aboutEpisode')
        .populate('author', 'name email profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Podcast.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: podcasts,
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
// GET /api/podcast/editor/review/:podcastId
// Editor gets full detail including audio to review
// ─────────────────────────────────────────
const getPodcastForReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;

    const podcast = await Podcast.findById(podcastId)
      .populate('author', 'name email profileImage bio');

    if (!podcast) throw createError(404, 'Podcast not found');

    return res.status(200).json({
      success: true,
      data: podcast,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/podcast/editor/edit/:podcastId
// Editor edits podcast directly — only pending allowed
// form-data: any field + audioFile/coverImage (optional)
// ─────────────────────────────────────────
const editorEditPodcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;
    const { title, summary, aboutEpisode, audioDuration, category, tags, isPremium } = req.body;

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw createError(404, 'Podcast not found');

    if (podcast.status !== 'pending') {
      throw createError(400, 'Editor can only edit pending podcasts');
    }

    const files = req.files as PodcastFiles;

    if (files?.audioFile?.[0]) {
      await deleteFileFromS3(podcast.audioFile);
      podcast.audioFile = await uploadAudioToS3(
        files.audioFile[0].buffer,
        files.audioFile[0].mimetype,
        'podcast-audio'
      );
    }

    if (files?.coverImage?.[0]) {
      await deleteImageFromS3(podcast.coverImage);
      podcast.coverImage = await uploadImageToS3(
        files.coverImage[0].buffer,
        files.coverImage[0].mimetype,
        'podcast-covers'
      );
    }

    if (title) podcast.title = title;
    if (summary) podcast.summary = summary;
    if (aboutEpisode) podcast.aboutEpisode = aboutEpisode;
    if (audioDuration) podcast.audioDuration = Number(audioDuration);
    if (category) podcast.category = category;
    if (tags) podcast.tags = Array.isArray(tags) ? tags : JSON.parse(tags);
    if (isPremium !== undefined) podcast.isPremium = isPremium === 'true' || isPremium === true;

    await podcast.save();

    return res.status(200).json({
      success: true,
      message: 'Podcast updated by editor',
      data: podcast,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/podcast/editor/approve/:podcastId
// ─────────────────────────────────────────
const approvePodcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw createError(404, 'Podcast not found');

    if (podcast.status !== 'pending') {
      throw createError(400, 'Only pending podcasts can be approved');
    }

    podcast.status = 'published';
    podcast.feedback = null;
    podcast.scheduledAt = null;
    await podcast.save();

    return res.status(200).json({
      success: true,
      message: 'Podcast approved and published',
      data: { id: podcast._id, status: podcast.status },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/podcast/editor/schedule/:podcastId
// body: { scheduledAt: "2026-04-10T08:00:00.000Z" }
// ─────────────────────────────────────────
const schedulePodcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) throw createError(400, 'scheduledAt date is required');

    const scheduleDate = new Date(scheduledAt);
    if (scheduleDate <= new Date()) {
      throw createError(400, 'Scheduled time must be in the future');
    }

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw createError(404, 'Podcast not found');

    if (podcast.status !== 'pending') {
      throw createError(400, 'Only pending podcasts can be scheduled');
    }

    podcast.scheduledAt = scheduleDate;
    podcast.status = 'published';
    await podcast.save();

    return res.status(200).json({
      success: true,
      message: `Podcast scheduled for ${scheduleDate.toISOString()}`,
      data: { id: podcast._id, status: podcast.status, scheduledAt: podcast.scheduledAt },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/podcast/editor/reject/:podcastId
// body: { feedback: "reason" }
// ─────────────────────────────────────────
const rejectPodcast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;
    const { feedback } = req.body;

    if (!feedback) throw createError(400, 'Feedback is required when rejecting');

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw createError(404, 'Podcast not found');

    if (podcast.status !== 'pending') {
      throw createError(400, 'Only pending podcasts can be rejected');
    }

    podcast.status = 'rejected';
    podcast.feedback = feedback;
    await podcast.save();

    return res.status(200).json({
      success: true,
      message: 'Podcast rejected with feedback',
      data: { id: podcast._id, status: podcast.status, feedback: podcast.feedback },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/podcast/editor/request-revision/:podcastId
// body: { feedback: "what to change" }
// ─────────────────────────────────────────
const requestPodcastRevision = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;
    const { feedback } = req.body;

    if (!feedback) throw createError(400, 'Feedback is required when requesting revision');

    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw createError(404, 'Podcast not found');

    if (podcast.status !== 'pending') {
      throw createError(400, 'Only pending podcasts can be sent for revision');
    }

    podcast.status = 'revision';
    podcast.feedback = feedback;
    await podcast.save();

    return res.status(200).json({
      success: true,
      message: 'Podcast sent back to writer for revision',
      data: { id: podcast._id, status: podcast.status, feedback: podcast.feedback },
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════
//  READER CONTROLLERS
// ══════════════════════════════════════════

// ─────────────────────────────────────────
// GET /api/podcast/reader/all
// List view — NO audioFile returned (saves bandwidth)
// Everyone can see the list — free and premium mixed
// query: ?category=politics&page=1&limit=10
// ─────────────────────────────────────────
const getAllPodcastsForReader = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = { status: 'published' };
    if (category) filter.category = category;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [podcasts, total] = await Promise.all([
      Podcast.find(filter)
        // No audioFile in list — only returned in detail
        .select('title summary coverImage category isPremium audioDuration author createdAt tags')
        .populate('author', 'name profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Podcast.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: podcasts,
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
// GET /api/podcast/reader/detail/:podcastId
// Full detail including audioFile for player
// Free → everyone gets full detail with audio
// Premium → only subscribed readers get audioFile
// ─────────────────────────────────────────
const getPodcastDetailForReader = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { podcastId } = req.params;

    const podcast = await Podcast.findOne({
      _id: podcastId,
      status: 'published',
    }).populate('author', 'name profileImage bio');

    if (!podcast) throw createError(404, 'Podcast not found');

    // Free podcast — give full detail including audio to everyone
    if (!podcast.isPremium) {
      return res.status(200).json({
        success: true,
        data: podcast,
      });
    }

    // Premium podcast — check subscription
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({
        success: false,
        isPremium: true,
        subscriptionRequired: true,
        message: 'Please login and subscribe to listen to premium content',
      });
    }

    const token = authHeader.split(' ')[1];
    const { verifyAccessToken } = await import('../../../utils/jwt.utils');
    const decoded = verifyAccessToken(token);

    const { Reader } = await import('../../reader/auth/reader.model');
    const reader = await Reader.findById(decoded.id);

    if (!reader || !reader.isSubscribed) {
      return res.status(403).json({
        success: false,
        isPremium: true,
        subscriptionRequired: true,
        message: 'Subscribe to listen to premium content',
      });
    }

    // Subscribed reader — full detail with audio
    return res.status(200).json({
      success: true,
      data: podcast,
    });
  } catch (error) {
    next(error);
  }
};

export {
  // Writer
  createPodcast,
  editPodcast,
  submitPodcast,
  deletePodcast,
  getMyPodcasts,
  getMyPodcastDetail,
  getScheduledPodcasts,
  getPodcastFeedback,
  // Editor
  getAllPodcastsForEditor,
  getPendingPodcasts,
  getPodcastForReview,
  editorEditPodcast,
  approvePodcast,
  schedulePodcast,
  rejectPodcast,
  requestPodcastRevision,
  // Reader
  getAllPodcastsForReader,
  getPodcastDetailForReader,
};