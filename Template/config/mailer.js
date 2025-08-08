// config/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:     process.env.SMTP_HOST,
  port:     process.env.SMTP_PORT,
  secure:   process.env.SMTP_SECURE === 'true', // true if you use port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function sendMail({ to, subject, html, text }) {
  return transporter.sendMail({
    from: `"RealEstatePlatform" <${process.env.SMTP_FROM}>`,
    to, subject, html, text
  });
}

module.exports = sendMail;