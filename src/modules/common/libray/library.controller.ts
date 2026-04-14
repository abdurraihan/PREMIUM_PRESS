import { Request, Response, NextFunction } from 'express';
import { Library } from './library.model';
import { Story } from '../story/story.model';
import { Podcast } from '../podcast/podcast.model';
import { createError } from '../../../utils/ApiError';

// Helper — get the actual content details based on contentType
const getContentDetails = async (contentType: string, contentId: string) => {
  if (contentType === 'story') {
    return Story.findById(contentId)
      .select('title summary coverImage category isPremium readingTime author createdAt')
      .populate('author', 'name profileImage');
  }
  if (contentType === 'podcast') {
    return Podcast.findById(contentId)
      .select('title summary coverImage category isPremium audioDuration author createdAt')
      .populate('author', 'name profileImage');
  }
  return null;
};

// ─────────────────────────────────────────
// POST /api/library/toggle
// Add or remove from saved or readLater list
// If already in list → remove (toggle off)
// If not in list → add (toggle on)
// body: { contentType, contentId, listType }
// ─────────────────────────────────────────
const toggleLibrary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentType, contentId, listType } = req.body;
    const readerId = req.readerId!;

    if (!contentType || !contentId || !listType) {
      return res.status(400).json({
        success: false,
        message: 'contentType, contentId and listType are required',
      });
    }

    // Make sure content actually exists and is published
    const content = await getContentDetails(contentType, contentId);
    if (!content) throw createError(404, `${contentType} not found`);

    // Check if already in this list
    const existing = await Library.findOne({
      reader: readerId,
      contentId,
      listType,
    });

    if (existing) {
      // Already saved — remove it
      await Library.findByIdAndDelete(existing._id);

      return res.status(200).json({
        success: true,
        message: `Removed from ${listType === 'saved' ? 'Saved' : 'Read Later'}`,
        data: { isSaved: false, listType },
      });
    }

    // Not saved — add it
    await Library.create({
      reader: readerId,
      contentType,
      contentId,
      listType,
    });

    return res.status(201).json({
      success: true,
      message: `Added to ${listType === 'saved' ? 'Saved' : 'Read Later'}`,
      data: { isSaved: true, listType },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET /api/library/saved
// Reader gets their Saved list
// query: ?contentType=story&page=1&limit=10
// ─────────────────────────────────────────
const getSavedList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const readerId = req.readerId!;
    const { contentType, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = {
      reader: readerId,
      listType: 'saved',
    };

    // Filter by contentType if provided — story or podcast
    if (contentType) filter.contentType = contentType;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Library.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Library.countDocuments(filter),
    ]);

    // Fetch actual content details for each saved item
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const content = await getContentDetails(item.contentType, item.contentId.toString());
        return {
          libraryId: item._id,       // for remove button
          listType: item.listType,
          contentType: item.contentType,
          savedAt: item.createdAt,
          content,                   // full content details
        };
      })
    );

    // Filter out any deleted content
    const validItems = enrichedItems.filter((item) => item.content !== null);

    return res.status(200).json({
      success: true,
      data: validItems,
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
// GET /api/library/read-later
// Reader gets their Read Later list
// query: ?contentType=podcast&page=1&limit=10
// ─────────────────────────────────────────
const getReadLaterList = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const readerId = req.readerId!;
    const { contentType, page = '1', limit = '10' } = req.query;

    const filter: Record<string, any> = {
      reader: readerId,
      listType: 'readLater',
    };

    if (contentType) filter.contentType = contentType;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Library.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Library.countDocuments(filter),
    ]);

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const content = await getContentDetails(item.contentType, item.contentId.toString());
        return {
          libraryId: item._id,
          listType: item.listType,
          contentType: item.contentType,
          savedAt: item.createdAt,
          content,
        };
      })
    );

    const validItems = enrichedItems.filter((item) => item.content !== null);

    return res.status(200).json({
      success: true,
      data: validItems,
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
// GET /api/library/check
// Check if a content is in saved or readLater
// Useful for showing filled/unfilled icon state
// query: ?contentId=664story111&listType=saved
// ─────────────────────────────────────────
const checkLibraryStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId, listType } = req.query;
    const readerId = req.readerId!;

    if (!contentId || !listType) {
      return res.status(400).json({
        success: false,
        message: 'contentId and listType are required',
      });
    }

    const existing = await Library.findOne({
      reader: readerId,
      contentId,
      listType,
    });

    return res.status(200).json({
      success: true,
      data: {
        isSaved: !!existing,
        listType,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// DELETE /api/library/remove/:libraryId
// Remove a specific item from any list
// Uses libraryId returned in list response
// ─────────────────────────────────────────
const removeFromLibrary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { libraryId } = req.params;
    const readerId = req.readerId!;

    const item = await Library.findById(libraryId);
    if (!item) throw createError(404, 'Item not found in library');

    // Only the owner can remove
    if (item.reader.toString() !== readerId) {
      throw createError(403, 'This item does not belong to you');
    }

    await Library.findByIdAndDelete(libraryId);

    return res.status(200).json({
      success: true,
      message: 'Removed from library',
    });
  } catch (error) {
    next(error);
  }
};

export {
  toggleLibrary,
  getSavedList,
  getReadLaterList,
  checkLibraryStatus,
  removeFromLibrary,
};