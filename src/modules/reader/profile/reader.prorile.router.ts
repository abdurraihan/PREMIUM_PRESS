import { Router } from 'express';
import { verifyReader } from '../../../middlewares/auth.middleware';
import { upload } from '../../../middlewares/upload.middleware';
import { getProfile, editProfile, changePassword, deleteAccount } from './reader.profile.controller';

const router = Router();

// verifyReader on each route — just like your link app style
router.get('/get-profile', verifyReader, getProfile);
router.patch('/edit', verifyReader, upload.single('profileImage'), editProfile);
router.patch('/change-password', verifyReader, changePassword);
router.delete('/delete', verifyReader, deleteAccount);

export default router;