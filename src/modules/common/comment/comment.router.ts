import { Router } from 'express';
import { verifyReaderOrWriter } from '../../../middlewares/auth.middleware';
import { addComment, getComments, editComment, deleteComment, likeComment, dislikeComment } from './comment.controller';

const router = Router();

// Public — anyone can read comments
router.get('/:contentType/:contentId', getComments);

// Reader or Writer — same endpoint, middleware detects role
router.post('/add', verifyReaderOrWriter, addComment);
router.patch('/edit/:commentId', verifyReaderOrWriter, editComment);
router.delete('/delete/:commentId', verifyReaderOrWriter, deleteComment);
router.patch('/like/:commentId', verifyReaderOrWriter, likeComment);
router.patch('/dislike/:commentId', verifyReaderOrWriter, dislikeComment);

export default router;