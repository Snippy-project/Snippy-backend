import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { corsOptions } from './src/config/cors.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 檢查必要的環境變數
if (!process.env.COOKIE_SECRET || !process.env.JWT_SECRET) {
  console.error('Missing required environment variables: COOKIE_SECRET, JWT_SECRET');
  process.exit(1);
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 首頁
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '短網址服務 API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 全域錯誤處理
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    message: '伺服器內部錯誤',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 處理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "找不到該路由",
    message: `路徑 ${req.originalUrl} 不存在`,
  });
});

app.listen(PORT, () => {
  console.log(`伺服器已啟動於 http://localhost:${PORT}`);
  console.log(`API 端點：http://localhost:${PORT}/api`);
  console.log(`路由檢查：http://localhost:${PORT}/api/health`);
});