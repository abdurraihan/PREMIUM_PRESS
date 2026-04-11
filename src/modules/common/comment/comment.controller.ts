import { Request, Response, NextFunction } from 'express';
import { Comment } from './comment.model';
import { createError } from '../../../utils/ApiError';
import { Types } from 'mongoose';

// Helper — gets the author id and role from request
// Both reader and writer can comment
const getAuthorFromRequest = (req: Request): { authorId: string; authorRole: 'reader' | 'writer' } | null => {
  if (req.readerId) return { authorId: req.readerId, authorRole: 'reader' };
  if (req.writerId) return { authorId: req.writerId, authorRole: 'writer' };
  return null;
};

// ─────────────────────────────────────────
// POST /api/comment/add
// Add a top level comment or reply to a comment
// body: { contentType, contentId, content, parentComment? }
// Both reader and writer can comment
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

    // If replying — make sure parent comment exists
    if (parentComment) {
      const parent = await Comment.findById(parentComment);
      if (!parent) throw createError(404, 'Parent comment not found');

      // Reply must be on the same content
      if (parent.contentId.toString() !== contentId) {
        throw createError(400, 'Reply must be on the same content as parent comment');
      }
    }

    const comment = await Comment.create({
      content,
      contentType,
      contentId,
      author: author.authorId,
      authorRole: author.authorRole,
      parentComment: parentComment || null,
    });

    // Populate author info before sending response
    await comment.populate(
      author.authorRole === 'reader'
        ? { path: 'author', model: 'Reader', select: 'name profileImage' }
        : { path: 'author', model: 'Writer', select: 'name profileImage' }
    );

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
// Get all top level comments for a content
// Replies are nested inside each comment
// query: ?page=1&limit=10
// ─────────────────────────────────────────
const getComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId } = req.params;
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get only top level comments first
    const [comments, total] = await Promise.all([
      Comment.find({
        contentType,
        contentId,
        parentComment: null,  // top level only
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(), // lean for faster query — we'll add replies manually
      Comment.countDocuments({
        contentType,
        contentId,
        parentComment: null,
        isDeleted: false,
      }),
    ]);

    // For each top level comment get its replies
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await Comment.find({
          parentComment: comment._id,
          isDeleted: false,
        })
          .sort({ createdAt: 1 }) // oldest reply first
          .lean();

        return {
          ...comment,
          likesCount: comment.likes.length,
          dislikesCount: comment.dislikes.length,
          replies: replies.map((reply) => ({
            ...reply,
            likesCount: reply.likes.length,
            dislikesCount: reply.dislikes.length,
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
// Edit your own comment — only content can change
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

    // Only the author can edit their comment
    if (comment.author.toString() !== author.authorId) {
      throw createError(403, 'You can only edit your own comments');
    }

    comment.content = content;
    await comment.save();

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
// Soft delete — comment shows as "comment removed"
// but replies stay visible in thread
// ─────────────────────────────────────────
const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { commentId } = req.params;

    const author = getAuthorFromRequest(req);
    if (!author) throw createError(401, 'Unauthorized');

    const comment = await Comment.findById(commentId);
    if (!comment) throw createError(404, 'Comment not found');

    // Only the author can delete their comment
    if (comment.author.toString() !== author.authorId) {
      throw createError(403, 'You can only delete your own comments');
    }

    // Soft delete — keep for reply thread integrity
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
// Like a comment — if already liked removes like
// If disliked first — removes dislike and adds like
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
      // Already liked — remove like (toggle off)
      comment.likes = comment.likes.filter((id) => !id.equals(userId));
    } else {
      // Add like
      comment.likes.push(userId);
      // Remove from dislike if was disliked
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
// Dislike a comment — if already disliked removes dislike
// If liked first — removes like and adds dislike
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
      // Already disliked — remove dislike (toggle off)
      comment.dislikes = comment.dislikes.filter((id) => !id.equals(userId));
    } else {
      // Add dislike
      comment.dislikes.push(userId);
      // Remove from like if was liked
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