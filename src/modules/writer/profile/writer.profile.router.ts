import { Router } from 'express';
import { verifyWriter } from '../../../middlewares/auth.middleware';
import { upload } from '../../../middlewares/upload.middleware';
import { getProfile, editProfile, changePassword, deleteAccount } from './writer.profile.controller';

const router = Router();

router.get('/get-profile', verifyWriter, getProfile);
router.patch('/edit', verifyWriter, upload.single('profileImage'), editProfile);
router.patch('/change-password', verifyWriter, changePassword);
router.delete('/delete', verifyWriter, deleteAccount);

export default router;