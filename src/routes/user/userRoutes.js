import express from 'express';
import { 
  getUserProfile,
  getUserQuota,
  getUserSubscriptions,
  getUserDomains,
  addCustomDomain,
  deleteCustomDomain
} from '../../controllers/userController.js';
import { requireFullAuth } from '../../middlewares/authMiddleware.js';
import { validateRequired } from '../../middlewares/validationMiddleware.js';

const router = express.Router();

// 完整認證
router.use(requireFullAuth);

// 取得個人資料和統計
router.get('/profile', getUserProfile);

// 取得用戶額度
router.get('/quota', getUserQuota);

// 取得用戶訂閱
router.get('/subscriptions', getUserSubscriptions);

// 取得用戶自訂域名
router.get('/domains', getUserDomains);

// 新增自訂域名
router.post('/domains', 
  validateRequired(['domain']),
  addCustomDomain
);

// 刪除自訂域名
router.delete('/domains/:domainId', deleteCustomDomain);

export default router;