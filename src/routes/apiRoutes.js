import express from 'express';
import authRoutes from './auth/authRoutes.js';
import urlRoutes from './url/urlRoutes.js';

const router = express.Router();

// 認證
router.use('/auth', authRoutes);

// 短網址
router.use('/urls', urlRoutes);

// 路由檢查
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API 運作正常',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth/*',
      urls: '/api/urls/*'
    }
  });
});

export default router;