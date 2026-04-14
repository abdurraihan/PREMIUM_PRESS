import { Router } from 'express';
import { verifyReader } from '../../../middlewares/auth.middleware';
import {
  toggleLibrary,
  getSavedList,
  getReadLaterList,
  checkLibraryStatus,
  removeFromLibrary,
} from './library.controller';

const router = Router();

// All library routes — reader only
router.post('/toggle', verifyReader, toggleLibrary);
router.get('/saved', verifyReader, getSavedList);
router.get('/read-later', verifyReader, getReadLaterList);
router.get('/check', verifyReader, checkLibraryStatus);
router.delete('/remove/:libraryId', verifyReader, removeFromLibrary);

export default router;