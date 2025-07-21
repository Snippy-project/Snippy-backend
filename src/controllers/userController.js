import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { usersTable } from '../models/users/usersTable.js';
import { userQuotasTable } from '../models/users/userQuotasTable.js';
import { userSubscriptionsTable } from '../models/users/userSubscriptionsTable.js';

// 取得用戶個人資料和統計
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // 查詢用戶基本資料、配額和訂閱
    const userProfile = await db.select({
      // 用戶基本資料
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      status: usersTable.status,
      isVerifiedEmail: usersTable.isVerifiedEmail,
      createdAt: usersTable.createdAt,
      
      // 配額資訊
      totalQuota: userQuotasTable.totalQuota,
      usedQuota: userQuotasTable.usedQuota,
      remainingQuota: userQuotasTable.remainingQuota
    })
    .from(usersTable)
    .leftJoin(userQuotasTable, eq(usersTable.id, userQuotasTable.userId))
    .where(eq(usersTable.id, userId))
    .limit(1);

    if (userProfile.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到用戶資料'
      });
    }

    const profile = userProfile[0];

    // 查詢用戶統計
    const stats = await getUserStats(userId);

    // 查詢活躍訂閱
    const activeSubscriptions = await db.select()
      .from(userSubscriptionsTable)
      .where(and(
        eq(userSubscriptionsTable.userId, userId),
        eq(userSubscriptionsTable.subscriptionStatus, 'active')
      ));

    res.json({
      success: true,
      data: {
        profile: profile,
        stats: stats,
        subscriptions: activeSubscriptions.map(sub => ({
          id: sub.id,
          type: sub.subscriptionType,
          status: sub.subscriptionStatus,
          startDate: sub.startDate,
          endDate: sub.endDate,
          daysRemaining: Math.ceil((new Date(sub.endDate) - new Date()) / (1000 * 60 * 60 * 24))
        }))
      }
    });

  } catch (error) {
    console.error('[USER] 取得用戶資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得用戶資料失敗，請稍後再試'
    });
  }
};

export {
  getUserProfile
};