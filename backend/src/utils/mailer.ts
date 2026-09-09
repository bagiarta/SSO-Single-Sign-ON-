import nodemailer from 'nodemailer';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: process.env['SMTP_HOST'] || 'smtp.example.com',
  port: parseInt(process.env['SMTP_PORT'] || '587', 10),
  secure: process.env['SMTP_SECURE'] === 'true',
  auth: {
    user: process.env['SMTP_USER'] || 'user',
    pass: process.env['SMTP_PASS'] || 'pass',
  },
});

export const sendResetPasswordEmail = async (to: string, resetLink: string) => {
  const mailOptions = {
    from: process.env['SMTP_FROM'] || '"SSO Enterprise" <noreply@enterprise-sso.com>',
    to,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Please click the following link to reset your password: ${resetLink}`,
    html: `
      <h2>Password Reset Request</h2>
      <p>You recently requested to reset your password for your account.</p>
      <p>Click the link below to reset it:</p>
      <a href="${resetLink}" style="display:inline-block;padding:10px 20px;color:#fff;background-color:#2e7d32;text-decoration:none;border-radius:5px;">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
      <p>This link will expire in 15 minutes.</p>
    `,
  };

  try {
    // Only attempt to send if SMTP_HOST is explicitly configured, otherwise log for development.
    if (process.env['SMTP_HOST']) {
      await transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to ${to}`);
    } else {
      logger.info(`[DEV MODE] Password reset email would be sent to: ${to}`);
      logger.info(`[DEV MODE] Reset Link: ${resetLink}`);
    }
  } catch (error) {
    logger.error(`Error sending password reset email to ${to}:`, error);
    throw new Error('Failed to send reset email');
  }
};

