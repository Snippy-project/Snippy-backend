import { setAuthCookies, clearAuthCookies, getAuthFromCookies, refreshAuthCookies, validateAuthCookies, needsTokenRefresh, updateUserDisplayCookie } from './cookieService.js';

const validateUserInfo = (user) => {
  const requiredFields = ['id', 'username', 'email'];
  
  for (const field of requiredFields) {
    if (!user[field]) {
      return {
        success: false,
        error: 'INVALID_USER_INFO',
        message: `缺少必要的用戶資訊: ${field}`
      };
    }
  }

  // 簡單的 email 格式驗證
  if (!user.email.includes('@')) {
    return {
      success: false,
      error: 'INVALID_EMAIL_FORMAT',
      message: '無效的 email 格式'
    };
  }

  return {
    success: true,
    message: '用戶資訊驗證通過'
  };
};

const loginUser = async (res, user, options = {}) => {
  try {
    const validation = validateUserInfo(user);
    if (!validation.success) {
      return validation;
    }

    // 檢查用戶狀態
    if (user.status !== 'active') {
      return {
        success: false,
        error: 'ACCOUNT_STATUS_INVALID',
        message: '帳號狀態異常，請聯繫管理員'
      };
    }

    // 檢查 email 是否已驗證
    if (!user.isVerifiedEmail) {
      return {
        success: false,
        error: 'EMAIL_NOT_VERIFIED',
        message: '請先驗證您的 email',
        needsEmailVerification: true
      };
    }

    const cookieResult = setAuthCookies(res, user, {
      rememberMe: options.rememberMe || false
    });

    if (!cookieResult.success) {
      return cookieResult;
    }

    return {
      success: true,
      message: '登入成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user'
      },
      redirectUrl: options.redirectUrl || '/dashboard'
    };
  } catch (error) {
    return {
      success: false,
      error: 'LOGIN_FAILED',
      message: '登入處理失敗，請重試'
    };
  }
};

const logoutUser = async (req, res) => {
  try {
    clearAuthCookies(res);
    return {
      success: true,
      message: '登出成功',
      redirectUrl: '/login'
    };
  } catch (error) {
    // 即使發生錯誤，也要清除 Cookie
    clearAuthCookies(res);
    return {
      success: true,
      message: '登出成功',
      redirectUrl: '/login'
    };
  }
};

const verifyAuth = async (req, res) => {
  try {
    const validationResult = validateAuthCookies(req);

    if (!validationResult.success) {
      // 如果 token 過期，嘗試刷新
      if (validationResult.needsRefresh) {
        const cookieAuth = getAuthFromCookies(req);
        if (cookieAuth.hasRefreshToken) {
          const refreshResult = refreshAuthCookies(req, res, cookieAuth.userInfo);
          if (refreshResult.success) {
            const newValidation = validateAuthCookies(req);
            return {
              success: true,
              user: newValidation.user,
              userInfo: newValidation.userInfo,
              message: 'Token 已自動刷新'
            };
          }
        }
      }
      return validationResult;
    }

    // 檢查是否需要預防性刷新
    if (needsTokenRefresh(req)) {
      const cookieAuth = getAuthFromCookies(req);
      if (cookieAuth.hasRefreshToken) {
        refreshAuthCookies(req, res, cookieAuth.userInfo);
      }
    }

    return {
      success: true,
      user: validationResult.user,
      userInfo: validationResult.userInfo,
      message: '認證驗證成功'
    };
  } catch (error) {
    return {
      success: false,
      error: 'AUTH_VERIFICATION_FAILED',
      message: '認證驗證失敗'
    };
  }
};

const hasPermission = (user, requiredRole) => {
  const roleHierarchy = {
    'user': 1,
    'admin': 2
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
};

export {
  loginUser,
  logoutUser,
  verifyAuth,
  validateUserInfo,
  hasPermission
};