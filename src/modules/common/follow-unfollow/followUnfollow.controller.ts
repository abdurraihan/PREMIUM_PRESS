import { Request, Response, NextFunction } from 'express';
import { Follow } from './followUnfollow.model';
import { Reader } from '../../reader/auth/reader.model';
import { Writer } from '../../writer/auth/writer.auth.model';
import { createError } from '../../../utils/ApiError';
import { sendNotification } from '../../../utils/notification.utils';


// ─────────────────────────────────────────
// POST /api/follow/toggle/:writerId
// Reader follows or unfollows a writer
// If already following → unfollow
// If not following → follow
// ─────────────────────────────────────────
const toggleFollow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const writerId = req.params.writerId as string;
        const readerId = req.readerId as string;

        // Make sure writer exists
        const writer = await Writer.findById(writerId);
        if (!writer) throw createError(404, 'Writer not found');

        // Reader cannot follow themselves if they are also a writer
        // (edge case safety check)
        if (readerId === writerId) {
            throw createError(400, 'You cannot follow yourself');
        }

        // Check if already following
        const existingFollow = await Follow.findOne({
            reader: readerId,
            writer: writerId,
        });

        if (existingFollow) {
            // Already following — unfollow now
            await Follow.findByIdAndDelete(existingFollow._id);

            // Decrement counts — Math.max ensures never goes below 0
            await Promise.all([
                Writer.findByIdAndUpdate(writerId, {
                    $inc: { followersCount: -1 },
                }),
                Reader.findByIdAndUpdate(readerId, {
                    $inc: { followingCount: -1 },
                }),
            ]);

            return res.status(200).json({
                success: true,
                message: `You unfollowed ${writer.name}`,
                data: { isFollowing: false, followersCount: Math.max(0, writer.followersCount - 1) },
            });
        }

        // Not following — follow now
        await Follow.create({ reader: readerId, writer: writerId });

        const [readerDoc] = await Promise.all([
            Reader.findById(readerId).select('name'),
            Writer.findByIdAndUpdate(writerId, { $inc: { followersCount: 1 } }),
            Reader.findByIdAndUpdate(readerId, { $inc: { followingCount: 1 } }),
        ]);

        sendNotification({
            receiver: writerId,
            receiverRole: 'writer',
            type: 'new_follower',
            message: `${readerDoc?.name || 'Someone'} started following you`,
        }).catch(() => {});

        return res.status(200).json({
            success: true,
            message: `You are now following ${writer.name}`,
            data: { isFollowing: true, followersCount: writer.followersCount + 1 },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────
// GET /api/follow/my-following
// Reader gets the list of writers they follow
// query: ?page=1&limit=10
// ─────────────────────────────────────────
const getMyFollowing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const readerId = req.readerId!;
        const { page = '1', limit = '10' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [follows, total] = await Promise.all([
            Follow.find({ reader: readerId })
                .populate('writer', 'name profileImage bio followersCount')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Follow.countDocuments({ reader: readerId }),
        ]);

        // Extract just the writer data cleanly
        const writers = follows.map((f) => f.writer);

        return res.status(200).json({
            success: true,
            data: writers,
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
// GET /api/follow/not-following
// Reader gets writers they are NOT yet following
// Good for "Discover writers" / suggestions section
// query: ?page=1&limit=10
// ─────────────────────────────────────────
const getNotFollowingWriters = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const readerId = req.readerId!;
        const { page = '1', limit = '10' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Get all writer IDs the reader already follows
        const alreadyFollowing = await Follow.find({ reader: readerId }).select('writer');
        const followingIds = alreadyFollowing.map((f) => f.writer);

        // Get writers not in that list
        const [writers, total] = await Promise.all([
            Writer.find({
                _id: { $nin: followingIds }, // exclude already followed writers
                isVerified: true,
            })
                .select('name profileImage bio followersCount')
                .sort({ followersCount: -1 }) // most followed first — better suggestions
                .skip(skip)
                .limit(limitNum),
            Writer.countDocuments({
                _id: { $nin: followingIds },
                isVerified: true,
            }),
        ]);

        return res.status(200).json({
            success: true,
            data: writers,
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
// GET /api/follow/writer/:writerId/followers
// Get all readers following a specific writer
// Anyone can see — no token needed
// query: ?page=1&limit=10
// ─────────────────────────────────────────
const getWriterFollowers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { writerId } = req.params;
        const { page = '1', limit = '10' } = req.query;

        const writer = await Writer.findById(writerId).select('name followersCount');
        if (!writer) throw createError(404, 'Writer not found');

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [follows, total] = await Promise.all([
            Follow.find({ writer: writerId })
                .populate('reader', 'name profileImage bio')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Follow.countDocuments({ writer: writerId }),
        ]);

        const readers = follows.map((f) => f.reader);

        return res.status(200).json({
            success: true,
            data: {
                writer: { name: writer.name, followersCount: writer.followersCount },
                followers: readers,
            },
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
// GET /api/follow/check/:writerId
// Check if current reader follows a specific writer
// Useful for showing Follow/Unfollow button state on frontend
// ─────────────────────────────────────────
const checkFollowStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { writerId } = req.params;
        const readerId = req.readerId!;

        const writer = await Writer.findById(writerId).select('name followersCount');
        if (!writer) throw createError(404, 'Writer not found');

        const follow = await Follow.findOne({ reader: readerId, writer: writerId });

        return res.status(200).json({
            success: true,
            data: {
                isFollowing: !!follow,  // true or false
                writer: {
                    name: writer.name,
                    followersCount: writer.followersCount,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────
// GET /api/follow/writer/my-followers
// Writer sees their own followers list
// ─────────────────────────────────────────
const getMyFollowers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const writerId = req.writerId!;
        const { page = '1', limit = '10' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [follows, total] = await Promise.all([
            Follow.find({ writer: writerId })
                .populate('reader', 'name profileImage bio')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Follow.countDocuments({ writer: writerId }),
        ]);

        const readers = follows.map((f) => f.reader);

        return res.status(200).json({
            success: true,
            data: readers,
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

export {
    toggleFollow,
    getMyFollowing,
    getNotFollowingWriters,
    getWriterFollowers,
    checkFollowStatus,
    getMyFollowers,
};