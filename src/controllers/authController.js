import bcrypt from 'bcrypt';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../config/db.js';
import { usersTable } from '../models/users/usersTable.js';
import { userQuotasTable } from '../models/users/userQuotasTable.js';
import { loginUser, logoutUser, verifyAuth } from '../services/auth/authService.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/auth/emailService.js';

// 註冊用戶
const register = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '請提供所有必要資訊'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: '密碼長度至少需要8個字符'
      });
    }

    const [existingUser] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: '此信箱已被註冊'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(usersTable).values({
      username,
      email,
      password: hashedPassword,
      phone,
      providerType: 'email',
      status: 'active',
      isVerifiedEmail: false
    }).returning({
			id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      phone: usersTable.phone,
      role: usersTable.role,
    });

    await db.insert(userQuotasTable).values({
      userId: newUser.id,
      totalQuota: 20,
      usedQuota: 0,
      remainingQuota: 20
    });

    const emailResult = await sendVerificationEmail(newUser.email, newUser.username);
    
    if (emailResult.success) {
      await db.update(usersTable)
        .set({
          emailVerificationToken: emailResult.token,
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小時
          lastVerificationEmailSent: new Date()
        })
        .where(eq(usersTable.id, newUser.id));
    }

    res.status(201).json({
      success: true,
      message: '註冊成功！請檢查您的信箱完成驗證',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        phone: newUser.phone,
        isVerifiedEmail: newUser.isVerifiedEmail
      },
      emailSent: emailResult.success
    });

  } catch (error) {
    console.error('[AUTH] 註冊失敗:', error);
    res.status(500).json({
      success: false,
      message: '註冊失敗，請稍後再試'
    });
  }
};

// 用戶登入
const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '請提供信箱和密碼'
      });
    }

    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '信箱或密碼錯誤'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '信箱或密碼錯誤'
      });
    }

    const loginResult = await loginUser(res, user, { rememberMe });

    if (loginResult.success) {
      res.json(loginResult);
    } else {
      res.status(401).json(loginResult);
    }

  } catch (error) {
    console.error('[AUTH] 登入失敗:', error);
    res.status(500).json({
      success: false,
      message: '登入失敗，請稍後再試'
    });
  }
};

// 用戶登出
const logout = async (req, res) => {
  try {
    const logoutResult = await logoutUser(req, res);
    res.json(logoutResult);
  } catch (error) {
    console.error('[AUTH] 登出失敗:', error);
    res.status(500).json({
      success: false,
      message: '登出失敗，請稍後再試'
    });
  }
};

// 驗證信箱
const verifyEmail = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '驗證 token 不能為空'
      });
    }

    const [user] = await db.select()
      .from(usersTable)
      .where(and(
        eq(usersTable.emailVerificationToken, token),
        gt(usersTable.emailVerificationExpires, new Date())
      ))
      .limit(1);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: '驗證 token 無效或已過期'
      });
    }

    await db.update(usersTable)
      .set({
        isVerifiedEmail: true,
        emailVerificationToken: null,
        emailVerificationExpires: null
      })
      .where(eq(usersTable.id, user.id));

    res.json({
      success: true,
      message: '信箱驗證成功！您現在可以登入使用所有功能',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isVerifiedEmail: true
      }
    });

  } catch (error) {
    console.error('[AUTH] 信箱驗證失敗:', error);
    res.status(500).json({
      success: false,
      message: '信箱驗證失敗，請稍後再試'
    });
  }
};

// 重新發送驗證信
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: '請提供信箱'
      });
    }

    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '找不到此信箱對應的用戶'
      });
    }

    if (user.isVerifiedEmail) {
      return res.status(400).json({
        success: false,
        message: '此信箱已經驗證過了'
      });
    }

    // 檢查是否過於頻繁發送（5分鐘內只能發送一次）
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (user.lastVerificationEmailSent && user.lastVerificationEmailSent > fiveMinutesAgo) {
      return res.status(429).json({
        success: false,
        message: '請等待5分鐘後再重新發送驗證信'
      });
    }

    const emailResult = await sendVerificationEmail(user.email, user.username);

    if (emailResult.success) {
      await db.update(usersTable)
        .set({
          emailVerificationToken: emailResult.token,
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
          lastVerificationEmailSent: new Date()
        })
        .where(eq(usersTable.id, user.id));

      res.json({
        success: true,
        message: '驗證信已重新發送，請檢查您的信箱'
      });
    } else {
      res.status(500).json({
        success: false,
        message: '驗證信發送失敗，請稍後再試'
      });
    }

  } catch (error) {
    console.error('[AUTH] 重新發送驗證信失敗:', error);
    res.status(500).json({
      success: false,
      message: '重新發送驗證信失敗，請稍後再試'
    });
  }
};

// 忘記密碼
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: '請提供信箱'
      });
    }

    const [user] = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) {
      return res.json({
        success: true,
        message: '如果此信箱存在，您將收到密碼重設信件'
      });
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (user.lastPasswordResetSent && user.lastPasswordResetSent > fiveMinutesAgo) {
      return res.status(429).json({
        success: false,
        message: '請等待5分鐘後再重新發送重設信'
      });
    }

    const emailResult = await sendPasswordResetEmail(user.email, user.username);

    if (emailResult.success) {
      await db.update(usersTable)
        .set({
          passwordResetToken: emailResult.token,
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1小時
          lastPasswordResetSent: new Date()
        })
        .where(eq(usersTable.id, user.id));
    }

    res.json({
      success: true,
      message: '如果此信箱存在，您將收到密碼重設信件'
    });

  } catch (error) {
    console.error('[AUTH] 忘記密碼處理失敗:', error);
    res.status(500).json({
      success: false,
      message: '處理失敗，請稍後再試'
    });
  }
};

// 重設密碼
const resetPassword = async (req, res) => {
  try {
    const token = req.params.token || req.query.token;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: '請提供 token 和新密碼'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: '密碼長度至少需要8個字符'
      });
    }

    const [user] = await db.select()
      .from(usersTable)
      .where(and(
        eq(usersTable.passwordResetToken, token),
        gt(usersTable.passwordResetExpires, new Date())
      ))
      .limit(1);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: '重設 token 無效或已過期'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.update(usersTable)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      })
      .where(eq(usersTable.id, user.id));

    res.json({
      success: true,
      message: '密碼重設成功！請使用新密碼登入'
    });

  } catch (error) {
    console.error('[AUTH] 重設密碼失敗:', error);
    res.status(500).json({
      success: false,
      message: '重設密碼失敗，請稍後再試'
    });
  }
};

// 取得當前用戶資訊
const me = async (req, res) => {
  try {
    const authResult = await verifyAuth(req, res);
    
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const [user] = await db.select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      status: usersTable.status,
      isVerifiedEmail: usersTable.isVerifiedEmail,
      createdAt: usersTable.createdAt,
      totalQuota: userQuotasTable.totalQuota,
      usedQuota: userQuotasTable.usedQuota,
      remainingQuota: userQuotasTable.remainingQuota
    })
    .from(usersTable)
    .leftJoin(userQuotasTable, eq(usersTable.id, userQuotasTable.userId))
    .where(eq(usersTable.id, authResult.user.id))
    .limit(1);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '找不到用戶資料'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        isVerifiedEmail: user.isVerifiedEmail,
        createdAt: user.createdAt,
        quota: {
          total: user.totalQuota,
          used: user.usedQuota,
          remaining: user.remainingQuota
        }
      }
    });

  } catch (error) {
    console.error('[AUTH] 取得用戶資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得用戶資料失敗，請稍後再試'
    });
  }
};

export {
  register,
  login,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  me
};