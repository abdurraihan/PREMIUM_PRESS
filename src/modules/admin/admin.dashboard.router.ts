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



// ── Stats ─────────────────────────────────────────────────
router.get('/stats', getDashboardStats);

// ── User Management ───────────────────────────────────────
router.get('/users', verifyAdmin, getUsers);
router.get('/users/:userId',verifyAdmin, getUserById);
router.delete('/users/:userId',verifyAdmin, deleteUser);

// ── Content Archive ───────────────────────────────────────
router.get('/archive', verifyAdmin, getArchive);

// ── Earnings ──────────────────────────────────────────────
router.get('/earnings',verifyAdmin, getEarnings);

// ── App Settings ──────────────────────────────────────────
router.get('/settings', getSettings);
router.patch('/settings',verifyAdmin, updateSettings);

export default router;
