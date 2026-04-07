import { Router } from 'express';
import { verifyAdmin } from '../../../middlewares/auth.middleware';
import { upload } from '../../../middlewares/upload.middleware';
import { getProfile, editProfile, changePassword, deleteAccount , createEditor} from './admin.profile.controller';

const router = Router();

router.get('/get-profile', verifyAdmin, getProfile);
router.patch('/edit', verifyAdmin, upload.single('profileImage'), editProfile);
router.patch('/change-password', verifyAdmin, changePassword);
router.delete('/delete', verifyAdmin, deleteAccount);
router.post('/create-editor', verifyAdmin, createEditor);

export default router;