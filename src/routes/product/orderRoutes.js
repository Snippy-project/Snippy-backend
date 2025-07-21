import express from 'express';
import { 
  createOrder, 
  getPaymentPage,
  handlePaymentCallback,
  getUserOrders, 
  getOrderById,
  simulatePaymentSuccess
} from '../../controllers/orderController.js';
import { requireFullAuth } from '../../middlewares/authMiddleware.js';
import { validateRequired } from '../../middlewares/validationMiddleware.js';

const router = express.Router();

// 建立訂單
router.post('/', 
  requireFullAuth,
  validateRequired(['productId']),
  createOrder
);

// 取得用戶訂單
router.get('/', requireFullAuth, getUserOrders);

// 取得特定訂單
router.get('/:orderId', requireFullAuth, getOrderById);

// 取得付款頁面
router.get('/:orderId/payment', requireFullAuth, getPaymentPage);

// 綠界付款回調
router.post('/payment/callback', handlePaymentCallback);

// 模擬付款成功
if (process.env.NODE_ENV === 'development') {
  router.post('/:orderId/simulate-payment', requireFullAuth, simulatePaymentSuccess);
}

export default router;