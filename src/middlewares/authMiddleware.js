import { verifyAuth } from '../services/auth/authService.js';

// 檢查用戶是否已登入
const requireAuth = async (req, res, next) => {
  try {
    const authResult = await verifyAuth(req, res);
    
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: '請先登入',
        error: authResult.error
      });
    }
    
    // 將用戶資訊附加到 request 物件
    req.user = authResult.user;
    req.userInfo = authResult.userInfo;
    
    next();
  } catch (error) {
    console.error('[AUTH] 認證中介軟體錯誤:', error);
    res.status(500).json({
      success: false,
      message: '認證驗證失敗'
    });
  }
};

// 檢查用戶是否已驗證 email
const requireVerifiedEmail = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '請先登入'
      });
    }
    
    if (!req.user.isVerifiedEmail) {
      return res.status(403).json({
        success: false,
        message: '請先驗證您的 email',
        needsEmailVerification: true
      });
    }
    
    next();
  } catch (error) {
    console.error('[AUTH] Email 驗證中介軟體錯誤:', error);
    res.status(500).json({
      success: false,
      message: '驗證失敗'
    });
  }
};

// 檢查用戶角色
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '請先登入'
        });
      }
      
      const userRole = req.user.role || 'user';
      const roleHierarchy = {
        'user': 1,
        'admin': 2
      };
      
      const userLevel = roleHierarchy[userRole] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;
      
      if (userLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          message: '權限不足'
        });
      }
      
      next();
    } catch (error) {
      console.error('[AUTH] 角色驗證中介軟體錯誤:', error);
      res.status(500).json({
        success: false,
        message: '權限驗證失敗'
      });
    }
  };
};

// 檢查用戶狀態
const requireActiveUser = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '請先登入'
      });
    }
    
    if (req.user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '帳號狀態異常，請聯繫管理員'
      });
    }
    
    next();
  } catch (error) {
    console.error('[AUTH] 用戶狀態驗證中介軟體錯誤:', error);
    res.status(500).json({
      success: false,
      message: '狀態驗證失敗'
    });
  }
};

// 組合中介軟體 - 需要完整認證
const requireFullAuth = [
  requireAuth,
  requireActiveUser,
  requireVerifiedEmail
];

export {
  requireAuth,
  requireVerifiedEmail,
  requireRole,
  requireActiveUser,
  requireFullAuth
};