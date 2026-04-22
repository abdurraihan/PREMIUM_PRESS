import { Router } from 'express';
import { verifyReaderOrWriter } from '../../../middlewares/auth.middleware';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification, updateFcmToken } from './notification.controller';

const router = Router();

// All routes require reader or writer auth
router.use(verifyReaderOrWriter);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/update-token', updateFcmToken);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
