import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../config/db.js';
import { urlsTable } from '../../models/urls/urlsTable.js';

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

const generateShortId = (length = 7) => {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
  }
  return result;
};

// 生成 shortId
const generateUniqueShortId = async (maxAttempts = 50) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shortId = generateShortId();
    
    const [existing] = await db.select()
      .from(urlsTable)
      .where(eq(urlsTable.shortId, shortId))
      .limit(1);

    if (!existing) {
      return shortId;
    }
    
    console.log(`[URL] shortId ${shortId} 已存在，重新生成... (嘗試 ${attempt + 1}/${maxAttempts})`);
  }
  
  throw new Error('無法生成唯一的 shortId');
};

// 驗證 URL 格式
const validateUrl = (url) => {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return { valid: false, error: '無效的域名' };
    }
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: '僅支援 HTTP 和 HTTPS 協議' };
    }
    
    return { valid: true, url: urlObj.toString() };
  } catch (error) {
    return { valid: false, error: 'URL 格式不正確' };
  }
};

// 從 URL 獲取標題
const getUrlTitle = async (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return null;
  }
};

// 檢查 URL 是否安全
const checkUrlSafety = (url) => {
  const dangerousDomains = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0'
  ];
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (dangerousDomains.includes(hostname)) {
      return { safe: false, reason: '不允許的內部地址' };
    }
    
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    if (ipRegex.test(hostname)) {
      return { safe: false, reason: '不允許直接使用 IP 地址' };
    }
    
    return { safe: true };
  } catch (error) {
    return { safe: false, reason: 'URL 解析失敗' };
  }
};

// 組成完整的短網址
const buildShortUrl = (shortId, customDomain = null) => {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  
  if (customDomain) {
    return `https://${customDomain}/${shortId}`;
  }
  
  return `${baseUrl}/${shortId}`;
};

export {
  generateShortId,
  generateUniqueShortId,
  validateUrl,
  getUrlTitle,
  checkUrlSafety,
  buildShortUrl
};