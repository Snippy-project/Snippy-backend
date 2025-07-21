import express from 'express';
import { 
  createUrl, 
  getUserUrls, 
  getUrlById, 
  updateUrl, 
  deleteUrl 
} from '../../controllers/urlController.js';
import { requireFullAuth } from '../../middlewares/authMiddleware.js';
import { validateRequired } from '../../middlewares/validationMiddleware.js';

const router = express.Router();

router.use(requireFullAuth);

// 創建短網址
router.post('/', validateRequired(['originalUrl']), createUrl);

// 取得用戶的短網址列表
router.get('/', getUserUrls);

// 取得特定短網址
router.get('/:id', getUrlById);

// 更新短網址標題
router.put('/:id', updateUrl);

// 刪除短網址
router.delete('/:id', deleteUrl);

export default router;