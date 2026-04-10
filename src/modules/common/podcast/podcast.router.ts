import { Router } from 'express';
import { verifyWriter, verifyEditor , verifyReader} from '../../../middlewares/auth.middleware';
import { uploadPodcastFiles, upload } from '../../../middlewares/upload.middleware';
import {
  createPodcast, editPodcast, submitPodcast, deletePodcast,
  getMyPodcasts, getMyPodcastDetail, getScheduledPodcasts, getPodcastFeedback,
  getAllPodcastsForEditor, getPendingPodcasts, getPodcastForReview,
  editorEditPodcast, approvePodcast, schedulePodcast,
  rejectPodcast, requestPodcastRevision,
  getAllPodcastsForReader, getPodcastDetailForReader,
} from './podcast.controller';

const router = Router();

// ── Writer Routes ────────────────────────
router.post('/writer/create', verifyWriter, uploadPodcastFiles, createPodcast);
router.patch('/writer/edit/:podcastId', verifyWriter, uploadPodcastFiles, editPodcast);
router.patch('/writer/submit/:podcastId', verifyWriter, submitPodcast);
router.delete('/writer/delete/:podcastId', verifyWriter, deletePodcast);
router.get('/writer/my-podcasts', verifyWriter, getMyPodcasts);
router.get('/writer/my-podcasts/:podcastId', verifyWriter, getMyPodcastDetail);
router.get('/writer/scheduled', verifyWriter, getScheduledPodcasts);
router.get('/writer/feedback/:podcastId', verifyWriter, getPodcastFeedback);

// ── Editor Routes ────────────────────────
router.get('/editor/all', verifyEditor, getAllPodcastsForEditor);
router.get('/editor/pending', verifyEditor, getPendingPodcasts);
router.get('/editor/review/:podcastId', verifyEditor, getPodcastForReview);
router.patch('/editor/edit/:podcastId', verifyEditor, uploadPodcastFiles, editorEditPodcast);
router.patch('/editor/approve/:podcastId', verifyEditor, approvePodcast);
router.patch('/editor/schedule/:podcastId', verifyEditor, schedulePodcast);
router.patch('/editor/reject/:podcastId', verifyEditor, rejectPodcast);
router.patch('/editor/request-revision/:podcastId', verifyEditor, requestPodcastRevision);

// ── Reader Routes ────────────────────────
router.get('/reader/all', getAllPodcastsForReader);
router.get('/reader/detail/:podcastId',verifyReader, getPodcastDetailForReader);

export default router;