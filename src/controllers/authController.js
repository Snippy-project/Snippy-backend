import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../config/db.js';
import { usersTable } from '../models/users/usersTable.js';
import { userQuotasTable } from '../models/users/userQuotasTable.js';
import { sendVerificationEmail } from '../services/auth/emailService.js';

// 註冊用戶
const register = async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;

    // 基本驗證
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

    // 檢查用戶是否已存在
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

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10);

    // 創建用戶
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

    // 初始化用戶配額
    await db.insert(userQuotasTable).values({
      userId: newUser.id,
      totalQuota: 20,
      usedQuota: 0,
      remainingQuota: 20
    });

    // 發送驗證信
    const emailResult = await sendVerificationEmail(newUser.email, newUser.username);
    
    if (emailResult.success) {
      // 更新用戶的驗證 token
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

export {
  register
};