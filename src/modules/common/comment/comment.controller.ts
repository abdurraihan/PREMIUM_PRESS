import { Request, Response, NextFunction } from 'express';
import { Comment } from './comment.model';
import { createError } from '../../../utils/ApiError';
import { Types } from 'mongoose';
import { Story } from '../story/story.model';
import { Podcast } from '../podcast/podcast.model';
import { LiveNews } from '../liveNews/liveNews.model';
import { sendNotification } from '../../../utils/notification.utils';

// Helper — gets author id and role from request
const getAuthorFromRequest = (req: Request): {
  authorId: string;
  authorRole: 'reader' | 'writer';
  authorModel: 'Reader' | 'Writer';
} | null => {
  if (req.readerId) return { authorId: req.readerId, authorRole: 'reader', authorModel: 'Reader' };
  if (req.writerId) return { authorId: req.writerId, authorRole: 'writer', authorModel: 'Writer' };
  return null;
};

// ─────────────────────────────────────────
// POST /api/comment/add
// Add top level comment or reply
// body: { contentType, contentId, content, parentComment? }
// ─────────────────────────────────────────
const addComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId, content, parentComment } = req.body;

    if (!contentType || !contentId || !content) {
      return res.status(400).json({
        success: false,
        message: 'contentType, contentId and content are required',
      });
    }

    const author = getAuthorFromRequest(req);
    if (!author) throw createError(401, 'Unauthorized');

    // Validate parent comment exists if replying
    let parentDoc: any = null;
    if (parentComment) {
      parentDoc = await Comment.findById(parentComment);
      if (!parentDoc) throw createError(404, 'Parent comment not found');
      if (parentDoc.contentId.toString() !== contentId) {
        throw createError(400, 'Reply must be on the same content as parent comment');
      }
    }

    const comment = await Comment.create({
      content,
      contentType,
      contentId,
      author: author.authorId,
      authorRole: author.authorRole,
      authorModel: author.authorModel,
      parentComment: parentComment || null,
    });

    await comment.populate({ path: 'author', select: 'name profileImage' });

    // Send notifications (non-fatal — never block the response)
    (async () => {
      try {
        if (!parentComment) {
          // Top-level comment — notify content author (always a Writer)
          let contentDoc: any = null;
          if (contentType === 'story') contentDoc = await Story.findById(contentId).select('author');
          else if (contentType === 'podcast') contentDoc = await Podcast.findById(contentId).select('author');
          else if (contentType === 'liveNews') contentDoc = await LiveNews.findById(contentId).select('author');

          if (contentDoc && contentDoc.author.toString() !== author.authorId) {
            await sendNotification({
              receiver: contentDoc.author,
              receiverRole: 'writer',
              type: 'new_comment',
              message: `Someone commented on your ${contentType}`,
              contentType,
              contentId,
            });
          }
        } else if (parentDoc) {
          // Reply — notify parent comment author
          if (parentDoc.author.toString() !== author.authorId) {
            await sendNotification({
              receiver: parentDoc.author,
              receiverRole: parentDoc.authorRole,
              type: 'comment_reply',
              message: 'Someone replied to your comment',
              contentType,
              contentId,
            });
          }
        }
      } catch {
        // Notification failure is non-fatal
      }
    })();

    return res.status(201).json({
      success: true,
      message: parentComment ? 'Reply added successfully' : 'Comment added successfully',
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/comment/:contentType/:contentId
// Get all top level comments with nested replies
// Author name and profileImage included in both
// query: ?page=1&limit=10
// ─────────────────────────────────────────
const getComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId } = req.params;
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [comments, total] = await Promise.all([
      Comment.find({
        contentType,
        contentId,
        parentComment: null,
        isDeleted: false,
      })
        // refPath on author field handles Reader vs Writer automatically
        .populate({ path: 'author', select: 'name profileImage' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),

      Comment.countDocuments({
        contentType,
        contentId,
        parentComment: null,
        isDeleted: false,
      }),
    ]);

    // Fetch replies for each top level comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment: any) => {
        const replies = await Comment.find({
          parentComment: comment._id,
          isDeleted: false,
        })
          .populate({ path: 'author', select: 'name profileImage' })
          .sort({ createdAt: 1 })
          .lean();

        return {
          ...comment,
          likesCount: comment.likes?.length || 0,
          dislikesCount: comment.dislikes?.length || 0,
          replies: replies.map((reply: any) => ({
            ...reply,
            likesCount: reply.likes?.length || 0,
            dislikesCount: reply.dislikes?.length || 0,
          })),
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: commentsWithReplies,
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
// PATCH /api/comment/edit/:commentId
// Edit your own comment content only
// ─────────────────────────────────────────
const editComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) throw createError(400, 'Content is required');

    const author = getAuthorFromRequest(req);
    if (!author) throw createError(401, 'Unauthorized');

    const comment = await Comment.findById(commentId);
    if (!comment) throw createError(404, 'Comment not found');
    if (comment.isDeleted) throw createError(400, 'Cannot edit a deleted comment');

    if (comment.author.toString() !== author.authorId) {
      throw createError(403, 'You can only edit your own comments');
    }

    comment.content = content;
    await comment.save();

    await comment.populate({ path: 'author', select: 'name profileImage' });

    return res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: comment,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE /api/comment/delete/:commentId
// Soft delete — keeps thread intact
// ─────────────────────────────────────────
const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;

    const author = getAuthorFromRequest(req);
    if (!author) throw createError(401, 'Unauthorized');

    const comment = await Comment.findById(commentId);
    if (!comment) throw createError(404, 'Comment not found');

    if (comment.author.toString() !== author.authorId) {
      throw createError(403, 'You can only delete your own comments');
    }

    comment.isDeleted = true;
    comment.content = 'This comment has been removed';
    await comment.save();

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/comment/like/:commentId
// Like — if already liked removes it (toggle)
// If disliked before — removes dislike and adds like
// ─────────────────────────────────────────
const likeComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;

    const author = getAuthorFromRequest(req);
    if (!author) throw createError(401, 'Unauthorized');

    const comment = await Comment.findById(commentId);
    if (!comment) throw createError(404, 'Comment not found');
    if (comment.isDeleted) throw createError(400, 'Cannot like a deleted comment');

    const userId = new Types.ObjectId(author.authorId);
    const alreadyLiked = comment.likes.some((id) => id.equals(userId));
    const alreadyDisliked = comment.dislikes.some((id) => id.equals(userId));

    if (alreadyLiked) {
      // Toggle off
      comment.likes = comment.likes.filter((id) => !id.equals(userId));
    } else {
      comment.likes.push(userId);
      // Remove from dislikes if was disliked
      if (alreadyDisliked) {
        comment.dislikes = comment.dislikes.filter((id) => !id.equals(userId));
      }
    }

    await comment.save();

    return res.status(200).json({
      success: true,
      message: alreadyLiked ? 'Like removed' : 'Comment liked',
      data: {
        likesCount: comment.likes.length,
        dislikesCount: comment.dislikes.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// PATCH /api/comment/dislike/:commentId
// Dislike — if already disliked removes it (toggle)
// If liked before — removes like and adds dislike
// ─────────────────────────────────────────
const dislikeComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;

    const author = getAuthorFromRequest(req);
    if (!author) throw createError(401, 'Unauthorized');

    const comment = await Comment.findById(commentId);
    if (!comment) throw createError(404, 'Comment not found');
    if (comment.isDeleted) throw createError(400, 'Cannot dislike a deleted comment');

    const userId = new Types.ObjectId(author.authorId);
    const alreadyDisliked = comment.dislikes.some((id) => id.equals(userId));
    const alreadyLiked = comment.likes.some((id) => id.equals(userId));

    if (alreadyDisliked) {
      // Toggle off
      comment.dislikes = comment.dislikes.filter((id) => !id.equals(userId));
    } else {
      comment.dislikes.push(userId);
      // Remove from likes if was liked
      if (alreadyLiked) {
        comment.likes = comment.likes.filter((id) => !id.equals(userId));
      }
    }

    await comment.save();

    return res.status(200).json({
      success: true,
      message: alreadyDisliked ? 'Dislike removed' : 'Comment disliked',
      data: {
        likesCount: comment.likes.length,
        dislikesCount: comment.dislikes.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export { addComment, getComments, editComment, deleteComment, likeComment, dislikeComment };