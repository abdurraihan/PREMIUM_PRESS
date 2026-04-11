import { Request, Response, NextFunction } from 'express';
import { React } from './react.model';
import { createError } from '../../../utils/ApiError';

// Helper — gets reactor id and role from request
const getReactorFromRequest = (req: Request): { reactorId: string; reactorRole: 'reader' | 'writer' } | null => {
  if (req.readerId) return { reactorId: req.readerId, reactorRole: 'reader' };
  if (req.writerId) return { reactorId: req.writerId, reactorRole: 'writer' };
  return null;
};

// ─────────────────────────────────────────
// POST /api/react/add
// Add or change reaction on story/podcast/liveNews
// If same reaction sent again — removes it (toggle off)
// If different reaction sent — updates to new one
// body: { contentType, contentId, reactionType }
// ─────────────────────────────────────────
const addOrUpdateReaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId, reactionType } = req.body;

    if (!contentType || !contentId || !reactionType) {
      return res.status(400).json({
        success: false,
        message: 'contentType, contentId and reactionType are required',
      });
    }

    const reactor = getReactorFromRequest(req);
    if (!reactor) throw createError(401, 'Unauthorized');

    // Check if this person already reacted to this content
    const existing = await React.findOne({
      contentId,
      reactor: reactor.reactorId,
    });

    if (existing) {
      if (existing.reactionType === reactionType) {
        // Same reaction — remove it (toggle off)
        await React.findByIdAndDelete(existing._id);

        return res.status(200).json({
          success: true,
          message: 'Reaction removed',
          data: { reactionType: null },
        });
      } else {
        // Different reaction — update to new one
        existing.reactionType = reactionType;
        await existing.save();

        return res.status(200).json({
          success: true,
          message: 'Reaction updated',
          data: { reactionType: existing.reactionType },
        });
      }
    }

    // No existing reaction — create new one
    const reaction = await React.create({
      contentType,
      contentId,
      reactor: reactor.reactorId,
      reactorRole: reactor.reactorRole,
      reactionType,
    });

    return res.status(201).json({
      success: true,
      message: 'Reaction added',
      data: { reactionType: reaction.reactionType },
    });
  } catch (error) {
    next(error);
  }
};
// GET /api/react/:contentType/:contentId
// No token needed — but if logged in shows myReaction
const getReactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId } = req.params;

    const reactions = await React.find({ contentType, contentId });

    const summary = {
      like: 0,
      love: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      total: reactions.length,
    };

    reactions.forEach((r) => {
      summary[r.reactionType]++;
    });

    // Try to get myReaction — only if token provided
    let myReaction = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const { verifyAccessToken } = await import('../../../utils/jwt.utils');
        const decoded = verifyAccessToken(token);

        const mine = reactions.find((r) => r.reactor.toString() === decoded.id);
        if (mine) myReaction = mine.reactionType;
      } catch {
        // Invalid token — just ignore, myReaction stays null
      }
    }

    return res.status(200).json({
      success: true,
      data: { summary, myReaction },
    });
  } catch (error) {
    next(error);
  }
};
export { addOrUpdateReaction, getReactions };