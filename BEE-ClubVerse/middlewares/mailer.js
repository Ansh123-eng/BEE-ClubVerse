import nodemailer from 'nodemailer';

const hasValidEmailConfig = 
  process.env.EMAIL_USER && 
  process.env.EMAIL_PASS && 
  !process.env.EMAIL_USER.includes('your-email') &&
  !process.env.EMAIL_PASS.includes('your-app-password');

let transporter = null;

if (hasValidEmailConfig) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  console.log('✓ Email service configured with valid credentials');
} else {
  console.warn('⚠ Email service disabled: no valid credentials in .env (EMAIL_USER and EMAIL_PASS must be configured)');
  transporter = {
    sendMail: (options, callback) => {
      console.log('[Email Mock] Would send email to:', options.to);
      if (callback) callback(null, { messageId: 'mock-' + Date.now() });
    }
  };
}

export default transporter;
