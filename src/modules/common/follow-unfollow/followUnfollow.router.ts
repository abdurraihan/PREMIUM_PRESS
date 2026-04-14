import { Router } from 'express';
import { verifyReader, verifyWriter } from '../../../middlewares/auth.middleware';
import {
  toggleFollow,
  getMyFollowing,
  getNotFollowingWriters,
  getWriterFollowers,
  checkFollowStatus,
  getMyFollowers,
} from './followUnfollow.controller';

const router = Router();

// ── Reader Routes ────────────────────────
// Follow or unfollow a writer
router.post('/toggle/:writerId', verifyReader, toggleFollow);

// Get all writers the reader follows
router.get('/my-following', verifyReader, getMyFollowing);

// Get writers reader is NOT following — for discover section
router.get('/not-following', verifyReader, getNotFollowingWriters);

// Check if reader follows a specific writer — for button state
router.get('/check/:writerId', verifyReader, checkFollowStatus);

// ── Writer Routes ────────────────────────
// Writer sees their own followers
router.get('/writer/my-followers', verifyWriter, getMyFollowers);

// ── Public Routes ────────────────────────
// Anyone can see a writer's followers list
router.get('/writer/:writerId/followers', getWriterFollowers);

export default router;