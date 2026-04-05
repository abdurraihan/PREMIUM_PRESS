import { Router } from 'express';
import { signup, verifyOtp, resendOtp, login, socialLogin, forgotPassword, resetPassword } from './reader.controller';

const router = Router();

router.post('/signup', signup);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/social-login', socialLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;