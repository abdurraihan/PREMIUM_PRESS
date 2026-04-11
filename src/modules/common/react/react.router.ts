import { Router } from 'express';
import { verifyReaderOrWriter } from '../../../middlewares/auth.middleware';
import { addOrUpdateReaction, getReactions } from './react.controller';

const router = Router();

// Public — anyone can see reactions
router.get('/:contentType/:contentId', getReactions);

// Reader or Writer — same endpoint
router.post('/add', verifyReaderOrWriter, addOrUpdateReaction);

export default router;