import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { usersTable } from '../models/users/usersTable.js';
import { userQuotasTable } from '../models/users/userQuotasTable.js';
import { userSubscriptionsTable } from '../models/users/userSubscriptionsTable.js';
import { customDomainsTable } from '../models/urls/customDomainsTable.js';
import { urlsTable } from '../models/urls/urlsTable.js';

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

// 取得用戶統計資料
const getUserStats = async (userId) => {
  try {
    // 短網址統計
    const urlStats = await db.select({
      totalUrls: sql`count(*)`,
      totalClicks: sql`sum(${urlsTable.clickCount})`
    })
    .from(urlsTable)
    .where(and(
      eq(urlsTable.userId, userId),
      eq(urlsTable.isActive, true)
    ));

    // 自訂域名統計
    const domainStats = await db.select({
      totalDomains: sql`count(*)`
    })
    .from(customDomainsTable)
    .where(and(
      eq(customDomainsTable.userId, userId),
      eq(customDomainsTable.isActive, true)
    ));

    return {
      totalUrls: urlStats[0]?.totalUrls || 0,
      totalClicks: urlStats[0]?.totalClicks || 0,
      totalDomains: domainStats[0]?.totalDomains || 0
    };
  } catch (error) {
    console.error('[USER] 取得用戶統計失敗:', error);
    return {
      totalUrls: 0,
      totalClicks: 0,
      totalDomains: 0
    };
  }
};

// 取得用戶配額資訊
const getUserQuota = async (req, res) => {
  try {
    const userId = req.user.id;

    const quotas = await db.select()
      .from(userQuotasTable)
      .where(eq(userQuotasTable.userId, userId))
      .limit(1);

    if (quotas.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到配額資訊'
      });
    }

    const quota = quotas[0];

    res.json({
      success: true,
      data: {
        total: quota.totalQuota,
        used: quota.usedQuota,
        remaining: quota.remainingQuota,
        usagePercentage: ((quota.usedQuota / quota.totalQuota) * 100).toFixed(1)
      }
    });

  } catch (error) {
    console.error('[USER] 取得配額資訊失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得配額資訊失敗，請稍後再試'
    });
  }
};

// 取得用戶訂閱資訊
const getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await db.select()
      .from(userSubscriptionsTable)
      .where(eq(userSubscriptionsTable.userId, userId))
      .orderBy(desc(userSubscriptionsTable.createdAt));

    const formattedSubscriptions = subscriptions.map(sub => {
      const now = new Date();
      const endDate = new Date(sub.endDate);
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      
      return {
        id: sub.id,
        type: sub.subscriptionType,
        typeText: getSubscriptionTypeText(sub.subscriptionType),
        status: sub.subscriptionStatus,
        statusText: getSubscriptionStatusText(sub.subscriptionStatus),
        startDate: sub.startDate,
        endDate: sub.endDate,
        daysRemaining: daysRemaining,
        isActive: sub.subscriptionStatus === 'active' && daysRemaining > 0,
        isExpiring: sub.subscriptionStatus === 'active' && daysRemaining <= 7 && daysRemaining > 0
      };
    });

    res.json({
      success: true,
      data: formattedSubscriptions
    });

  } catch (error) {
    console.error('[USER] 取得訂閱資訊失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得訂閱資訊失敗，請稍後再試'
    });
  }
};

// 取得用戶自訂域名
const getUserDomains = async (req, res) => {
  try {
    const userId = req.user.id;

    // 檢查用戶是否有自訂域名訂閱
    const hasSubscription = await checkCustomDomainSubscription(userId);
    
    if (!hasSubscription) {
      return res.json({
        success: true,
        data: [],
        message: '您尚未訂閱自訂域名功能',
        needsSubscription: true
      });
    }

    const domains = await db.select()
      .from(customDomainsTable)
      .where(and(
        eq(customDomainsTable.userId, userId),
        eq(customDomainsTable.isActive, true)
      ))
      .orderBy(desc(customDomainsTable.createdAt));

    res.json({
      success: true,
      data: domains
    });

  } catch (error) {
    console.error('[USER] 取得自訂域名失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得自訂域名失敗，請稍後再試'
    });
  }
};

// 新增自訂域名
const addCustomDomain = async (req, res) => {
  try {
    const { domain } = req.body;
    const userId = req.user.id;

    // 驗證必要欄位
    if (!domain) {
      return res.status(400).json({
        success: false,
        message: '請提供域名'
      });
    }

    // 檢查用戶是否有自訂域名訂閱
    const hasSubscription = await checkCustomDomainSubscription(userId);
    
    if (!hasSubscription) {
      return res.status(403).json({
        success: false,
        message: '您需要先訂閱自訂域名功能',
        needsSubscription: true
      });
    }

    // 簡單的域名格式驗證
    const domainRegex = /^(?!\-)([a-zA-Z0-9\-]{1,63}\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return res.status(400).json({
        success: false,
        message: '請提供有效的域名格式'
      });
    }

    // 檢查域名是否已被使用
    const existingDomains = await db.select()
      .from(customDomainsTable)
      .where(and(
        eq(customDomainsTable.domain, domain),
        eq(customDomainsTable.isActive, true)
      ))
      .limit(1);

    if (existingDomains.length > 0) {
      return res.status(409).json({
        success: false,
        message: '此域名已被使用'
      });
    }

    // 新增域名
    const newDomain = await db.insert(customDomainsTable).values({
      userId,
      domain,
      isActive: true
    }).returning();

    res.status(201).json({
      success: true,
      message: '自訂域名新增成功',
      data: newDomain[0]
    });

  } catch (error) {
    console.error('[USER] 新增自訂域名失敗:', error);
    res.status(500).json({
      success: false,
      message: '新增自訂域名失敗，請稍後再試'
    });
  }
};

// 輔助函數：取得訂閱類型文字
const getSubscriptionTypeText = (type) => {
  const typeMap = {
    'custom_domain': '自訂域名（月費）',
    'custom_domain_yearly': '自訂域名（年費）'
  };
  return typeMap[type] || type;
};

// 輔助函數：取得訂閱狀態文字
const getSubscriptionStatusText = (status) => {
  const statusMap = {
    'active': '使用中',
    'expired': '已過期',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
};

export {
  getUserProfile,
  getUserQuota,
  getUserSubscriptions,
  getUserDomains,
  addCustomDomain
};