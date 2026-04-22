import { Router } from 'express';
import { verifyAdmin } from '../../middlewares/auth.middleware';
import {
  getDashboardStats,
  getUsers,
  getUserById,
  deleteUser,
  getArchive,
  getEarnings,
  getSettings,
  updateSettings,
} from './admin.dashboard.controller';

const router = Router();

router.use(verifyAdmin);

// ── Stats ─────────────────────────────────────────────────
router.get('/stats', getDashboardStats);

// ── User Management ───────────────────────────────────────
router.get('/users', getUsers);
router.get('/users/:userId', getUserById);
router.delete('/users/:userId', deleteUser);

// ── Content Archive ───────────────────────────────────────
router.get('/archive', getArchive);

// ── Earnings ──────────────────────────────────────────────
router.get('/earnings', getEarnings);

// ── App Settings ──────────────────────────────────────────
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);

export default router;
