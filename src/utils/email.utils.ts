import nodemailer from 'nodemailer';
import { SMTP_USER, SMTP_PASS } from '../config/env';

// Gmail transporter using app password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const sendOtpEmail = async (email: string, otp: string): Promise<void> => {
  await transporter.sendMail({
    from: `"PremiumPress" <${SMTP_USER}>`,
    to: email,
    subject: 'Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 420px; margin: auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #3B3BFF;">Verification Code</h2>
        <p>Enter the code below to verify your account. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #3B3BFF; margin: 24px 0;">${otp}</div>
        <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
};

export { sendOtpEmail };