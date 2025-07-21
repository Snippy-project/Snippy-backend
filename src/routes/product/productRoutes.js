import express from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getAllProducts,
  getProductStats
} from '../../controllers/productController.js';
import { requireAuth, requireRole } from '../../middlewares/authMiddleware.js';
import { validateRequired } from '../../middlewares/validationMiddleware.js';

const router = express.Router();

// 取得啟用的商品
router.get('/', getProducts);

// 取得特定商品
router.get('/:id', getProductById);

// 取得所有商品（管理員）
router.get('/admin/all', requireAuth, requireRole('admin'), getAllProducts);

// 商品統計（管理員）
router.get('/admin/stats', requireAuth, requireRole('admin'), getProductStats);

// 創建商品（管理員）
router.post('/admin/createproduct', 
  requireAuth, 
  requireRole('admin'),
  validateRequired(['name', 'description', 'price', 'productType']),
  createProduct
);

// 更新商品（管理員）
router.put('/admin/updateproduct/:id', 
  requireAuth, 
  requireRole('admin'),
  updateProduct
);

// 刪除商品（管理員）
router.delete('/admin/deleteproduct/:id', 
  requireAuth, 
  requireRole('admin'),
  deleteProduct
);

export default router;