import { COOKIE_NAMES, cookieConfig, clearCookieConfig } from '../../config/cookies.js';
import { generateTokenPair, verifyAccessToken, refreshAccessToken, isTokenExpiringSoon } from './jwtService.js';

const setAuthCookies = (res, user, options = {}) => {
  try {
    const tokenResult = generateTokenPair(user);
    
    if (!tokenResult.success) {
      throw new Error(tokenResult.message);
    }

    const { accessToken, refreshToken } = tokenResult;

    res.cookie(COOKIE_NAMES.AUTH_TOKEN, accessToken, cookieConfig.auth_token);

    const displayInfo = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
      providerType: 'email',
      avatarUrl: user.avatarUrl || null,
      lastLoginAt: new Date().toISOString()
    };
    
    res.cookie(COOKIE_NAMES.USER_DISPLAY, JSON.stringify(displayInfo), cookieConfig.user_display);

    if (options.rememberMe) {
      res.cookie(COOKIE_NAMES.REMEMBER_ME, refreshToken, cookieConfig.remember_me);
    }

    return { 
      success: true, 
      message: '認證 Cookie 設定成功', 
    };
  } catch (error) {
    console.error('設定認證 Cookie 失敗:', error);
    return {
      success: false,
      error: 'COOKIE_SET_FAILED',
      message: '設定認證資訊失敗'
    };
  }
};

const clearAuthCookies = (res) => {
  try {
    res.clearCookie(COOKIE_NAMES.AUTH_TOKEN, clearCookieConfig);
    res.clearCookie(COOKIE_NAMES.USER_DISPLAY, clearCookieConfig);
    res.clearCookie(COOKIE_NAMES.REMEMBER_ME, clearCookieConfig);

    return {
      success: true,
      message: '所有認證 Cookie 已清除'
    };
  } catch (error) {
    console.error('清除認證 Cookie 失敗:', error);
    return {
      success: false,
      error: 'COOKIE_CLEAR_FAILED',
      message: '清除認證資訊失敗'
    };
  }
};

const getAuthFromCookies = (req) => {
  try {
    const authToken = req.signedCookies?.[COOKIE_NAMES.AUTH_TOKEN];
    const refreshToken = req.signedCookies?.[COOKIE_NAMES.REMEMBER_ME];
    
    const userDisplay = req.cookies?.[COOKIE_NAMES.USER_DISPLAY];

    let userInfo = null;
    if (userDisplay) {
      try {
        userInfo = JSON.parse(userDisplay);
      } catch (error) {
        console.warn('解析用戶顯示資訊失敗:', error);
      }
    }

    return {
      hasAuthToken: !!authToken,
      hasUserInfo: !!userInfo,
      hasRefreshToken: !!refreshToken,
      userInfo: userInfo ? {
        id: userInfo.id,
        username: userInfo.username,
      } : null,
			getAuthToken: () => authToken,
      getRefreshToken: () => refreshToken
    };
  } catch (error) {
    console.error('獲取 Cookie 認證資訊失敗:', error);
    return {
      hasAuthToken: false,
      hasUserInfo: false,
      hasRefreshToken: false,
      userInfo: null,
      getAuthToken: () => null,
      getRefreshToken: () => null
    };
  }
};

const refreshAuthCookies = (req, res, latestUserInfo) => {
  try {
    const cookieAuth = getAuthFromCookies(req);
    
    if (!cookieAuth.hasRefreshToken) {
      return {
        success: false,
        error: 'NO_REFRESH_TOKEN',
        message: '沒有 refresh token，請重新登入'
      };
    }

		const refreshToken = cookieAuth.getRefreshToken();
    const refreshResult = refreshAccessToken(refreshToken, latestUserInfo);

    if (!refreshResult.success) {
      return refreshResult;
    }

    res.cookie(COOKIE_NAMES.AUTH_TOKEN, refreshResult.accessToken, cookieConfig.auth_token);

    const updatedDisplayInfo = {
      ...latestUserInfo,
      lastRefreshAt: new Date().toISOString()
    };
    
    res.cookie(COOKIE_NAMES.USER_DISPLAY, JSON.stringify(updatedDisplayInfo), cookieConfig.user_display);

    return {
      success: true,
      message: '認證 Cookie 已刷新',
      newAccessToken: refreshResult.accessToken,
      userId: refreshResult.userId
    };
  } catch (error) {
    console.error('刷新認證 Cookie 失敗:', error);
    return {
      success: false,
      error: 'COOKIE_REFRESH_FAILED',
      message: '刷新認證失敗'
    };
  }
};

const validateAuthCookies = (req) => {
  try {
    const cookieAuth = getAuthFromCookies(req);
    
    if (!cookieAuth.hasAuthToken) {
      return {
        success: false,
        error: 'NO_AUTH_TOKEN',
        message: '沒有認證 token'
      };
    }

		const authToken = cookieAuth.getAuthToken();
    const tokenResult = verifyAccessToken(authToken);
    
    if (!tokenResult.success) {
      return {
        success: false,
        error: tokenResult.error,
        message: tokenResult.message,
        needsRefresh: tokenResult.error === 'TokenExpiredError'
      };
    }

    return {
      success: true,
      user: tokenResult.data,
      userInfo: cookieAuth.userInfo,
    };
  } catch (error) {
    console.error('驗證認證 Cookie 失敗:', error);
    return {
      success: false,
      error: 'VALIDATION_FAILED',
      message: '驗證認證資訊失敗'
    };
  }
};

const needsTokenRefresh = (req) => {
  try {
    const cookieAuth = getAuthFromCookies(req);
    
    if (!cookieAuth.hasAuthToken) {
      return false;
    }

		const authToken = cookieAuth.getAuthToken();
    return isTokenExpiringSoon(authToken);
  } catch (error) {
    console.error('檢查 token 刷新需求失敗:', error);
    return false;
  }
};

const updateUserDisplayCookie = (res, userInfo) => {
  try {
    const displayInfo = {
      ...userInfo,
      lastUpdatedAt: new Date().toISOString()
    };
    
    res.cookie(
      COOKIE_NAMES.USER_DISPLAY, 
      JSON.stringify(displayInfo), 
      cookieConfig.user_display
    );

    return {
      success: true,
      message: '用戶顯示資訊已更新'
    };
  } catch (error) {
    console.error('更新用戶顯示資訊失敗:', error);
    return {
      success: false,
      error: 'UPDATE_DISPLAY_FAILED',
      message: '更新顯示資訊失敗'
    };
  }
};

export {
  setAuthCookies,
  clearAuthCookies,
  getAuthFromCookies,
  refreshAuthCookies,
  validateAuthCookies,
  needsTokenRefresh,
  updateUserDisplayCookie
};