import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// 建立郵件傳送器
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const buildUrl = (type, token) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${baseUrl}/${type}?token=${token}`;
};

const getSimpleTemplate = (title, content, buttonText, buttonUrl) => {
  return `
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
      <div style="background: #007bff; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; color: white;">${title}</h1>
      </div>
      <div style="padding: 30px; background: #f9f9f9;">
          ${content}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${buttonUrl}" 
              style="background-color: #007bff; color: white; padding: 12px 30px; 
              text-decoration: none; border-radius: 5px; display: inline-block;">
              ${buttonText}
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            或複製連結：<br>
            <span style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px; display: block; margin-top: 10px;">
              ${buttonUrl}
            </span>
          </p>
      </div>
    </div>
  `;
};

const sendEmail = async (to, subject, htmlContent) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: to,
      subject: subject,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: '郵件發送成功'
    };
  } catch (error) {
    console.error('[EMAIL] 發送失敗:', error);
    
    return {
      success: false,
      error: 'EMAIL_SEND_FAILED',
      message: '郵件發送失敗，請稍後再試'
    };
  }
};

const sendVerificationEmail = async (email, username) => {
  const token = generateToken();
  const verificationUrl = buildUrl('verify-email', token);
  
  const content = `
    <h2>哈囉 ${username}！</h2>
    <p>感謝您註冊我們的服務！請點擊下方按鈕來驗證您的信箱：</p>
  `;
  
  const html = getSimpleTemplate('信箱驗證', content, '驗證信箱', verificationUrl);
  
  const result = await sendEmail(email, '信箱驗證', html);
  
  return {
    ...result,
    token: result.success ? token : null
  };
};

const sendPasswordResetEmail = async (email, username) => {
  const token = generateToken();
  const resetUrl = buildUrl('reset-password', token);
  
  const content = `
    <h2>哈囉 ${username}！</h2>
    <p>我們收到您的密碼重設請求。請點擊下方按鈕重設您的密碼：</p>
  `;
  
  const html = getSimpleTemplate('密碼重設', content, '重設密碼', resetUrl);
  
  const result = await sendEmail(email, '密碼重設', html);
  
  return {
    ...result,
    token: result.success ? token : null
  };
};

export {
  generateToken,
  sendVerificationEmail,
  sendPasswordResetEmail
};