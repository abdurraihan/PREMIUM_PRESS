import { Router } from 'express';
import { verifyAdmin } from '../../../middlewares/auth.middleware';
import { getPlans, updatePlan, getSubscribers, getStats } from './admin.subscription.controller';

const router = Router();

router.get('/plans', verifyAdmin, getPlans);
router.patch('/plans/:planType', verifyAdmin, updatePlan);
router.get('/subscribers', verifyAdmin, getSubscribers);
router.get('/stats', verifyAdmin, getStats);

export default router;
