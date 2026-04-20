import { Router } from 'express';
import { getTopStories, getTopPodcasts, getWriterProfile } from './explore.controller';

const router = Router();

// All public — no token needed
// But writer profile checks follow status if token provided
router.get('/top-stories', getTopStories);
router.get('/top-podcasts', getTopPodcasts);
router.get('/writer/:writerId', getWriterProfile);

export default router;