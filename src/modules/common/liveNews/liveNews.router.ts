import { Router } from 'express';
import { verifyWriter } from '../../../middlewares/auth.middleware';
import { postLiveNews, editLiveNews, deleteLiveNews, getMyLiveNews, getAllLiveNews } from './liveNews.controller';

const router = Router();

// ── Writer Routes ────────────────────────
router.post('/writer/post', verifyWriter, postLiveNews);
router.patch('/writer/edit/:newsId', verifyWriter, editLiveNews);
router.delete('/writer/delete/:newsId', verifyWriter, deleteLiveNews);
router.get('/writer/my-news', verifyWriter, getMyLiveNews);

// ── Reader Route — single API, always free ──
router.get('/reader/all', getAllLiveNews);

export default router;