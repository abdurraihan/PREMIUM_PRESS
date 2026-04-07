import { Router } from 'express';
import { verifyEditor } from '../../../middlewares/auth.middleware';
import { upload } from '../../../middlewares/upload.middleware';
import { getProfile, editProfile, changePassword, deleteAccount } from './editor.profile.controller';

const router = Router();

router.get('/get-profile', verifyEditor, getProfile);
router.patch('/edit', verifyEditor, upload.single('profileImage'), editProfile);
router.patch('/change-password', verifyEditor, changePassword);
router.delete('/delete', verifyEditor, deleteAccount);

export default router;