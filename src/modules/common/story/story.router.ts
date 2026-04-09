import { Router } from 'express';
import { verifyWriter, verifyEditor, verifyReader } from '../../../middlewares/auth.middleware';
import { upload } from '../../../middlewares/upload.middleware';
import {
  createStory,
  editStory,
  submitStory,
  deleteStory,
  getMyStories,
  getMyStoryDetail,
  getScheduledStories,
  getStoryFeedback,
  getPendingStories,
  getStoryForReview,
  approveStory,
  scheduleStory,
  rejectStory,
  requestRevision,
  editorEditStory,
  getAllStoriesForEditor,
  getAllStoriesForReader,
  getStoryDetailForReader,
} from './story.controller';

const router = Router();

// ── Writer Routes ────────────────────────
router.post('/writer/create', verifyWriter, upload.single('coverImage'), createStory);
router.patch('/writer/edit/:storyId', verifyWriter, upload.single('coverImage'), editStory);
router.patch('/writer/submit/:storyId', verifyWriter, submitStory);
router.delete('/writer/delete/:storyId', verifyWriter, deleteStory);
router.get('/writer/my-stories', verifyWriter, getMyStories);
router.get('/writer/my-stories/:storyId', verifyWriter, getMyStoryDetail);
router.get('/writer/scheduled', verifyWriter, getScheduledStories);
router.get('/writer/feedback/:storyId', verifyWriter, getStoryFeedback);

// ── Editor Routes ────────────────────────
router.get('/editor/all', verifyEditor, getAllStoriesForEditor);
router.get('/editor/pending', verifyEditor, getPendingStories);
router.get('/editor/review/:storyId', verifyEditor, getStoryForReview);
router.patch('/editor/approve/:storyId', verifyEditor, approveStory);
router.patch('/editor/schedule/:storyId', verifyEditor, scheduleStory);
router.patch('/editor/reject/:storyId', verifyEditor, rejectStory);
router.patch('/editor/request-revision/:storyId', verifyEditor, requestRevision);
router.patch('/editor/edit/:storyId', verifyEditor, upload.single('coverImage'), editorEditStory);

// ── Reader Routes ────────────────────────
// verifyReader is optional here — needed only for premium check
router.get('/reader/all', getAllStoriesForReader);
router.get('/reader/detail/:storyId', getStoryDetailForReader);

export default router;