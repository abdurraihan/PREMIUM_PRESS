import { Router } from 'express';
import { verifyWriter, verifyEditor } from '../../../middlewares/auth.middleware';
import {
  postLiveNews, submitLiveNews, editLiveNews, deleteLiveNews, getMyLiveNews, getMyLiveNewsDetail,
  getAllLiveNewsForEditor, getPendingLiveNews, getLiveNewsForReview,
  approveLiveNews, scheduleLiveNews, rejectLiveNews, requestLiveNewsRevision, editorEditLiveNews,
  getAllLiveNews,
} from './liveNews.controller';

const router = Router();

// ── Writer Routes ────────────────────────
router.post('/writer/post', verifyWriter, postLiveNews);
router.patch('/writer/submit/:newsId', verifyWriter, submitLiveNews);
router.patch('/writer/edit/:newsId', verifyWriter, editLiveNews);
router.delete('/writer/delete/:newsId', verifyWriter, deleteLiveNews);
router.get('/writer/my-news', verifyWriter, getMyLiveNews);
router.get('/writer/my-news/:newsId', verifyWriter, getMyLiveNewsDetail);

// ── Editor Routes ────────────────────────
router.get('/editor/all', verifyEditor, getAllLiveNewsForEditor);
router.get('/editor/pending', verifyEditor, getPendingLiveNews);
router.get('/editor/review/:newsId', verifyEditor, getLiveNewsForReview);
router.patch('/editor/approve/:newsId', verifyEditor, approveLiveNews);
router.patch('/editor/schedule/:newsId', verifyEditor, scheduleLiveNews);
router.patch('/editor/reject/:newsId', verifyEditor, rejectLiveNews);
router.patch('/editor/request-revision/:newsId', verifyEditor, requestLiveNewsRevision);
router.patch('/editor/edit/:newsId', verifyEditor, editorEditLiveNews);

// ── Reader Routes ────────────────────────
router.get('/reader/all', getAllLiveNews);

export default router;
