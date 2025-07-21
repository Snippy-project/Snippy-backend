import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { urlsTable } from '../models/urls/urlsTable.js';
import { userQuotasTable } from '../models/users/userQuotasTable.js';
import { customDomainsTable } from '../models/urls/customDomainsTable.js';
import { generateUniqueShortId, validateUrl, getUrlTitle, checkUrlSafety, buildShortUrl } from '../services/url/urlService.js';

// 創建短網址
const createUrl = async (req, res) => {
  try {
    const { originalUrl, title, customDomainId } = req.body;
    const userId = req.user.id;

    // 驗證必要欄位
    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: '請提供原始網址'
      });
    }

    // 檢查用戶配額
    const quota = await db.select()
      .from(userQuotasTable)
      .where(eq(userQuotasTable.userId, userId))
      .limit(1);

    if (quota.length === 0 || quota[0].remainingQuota <= 0) {
      return res.status(403).json({
        success: false,
        message: '配額不足，請購買更多使用次數',
        needsQuota: true
      });
    }

    // 驗證 URL 格式
    const urlValidation = validateUrl(originalUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({
        success: false,
        message: urlValidation.error
      });
    }

    // 檢查 URL 安全性
    const safetyCheck = checkUrlSafety(urlValidation.url);
    if (!safetyCheck.safe) {
      return res.status(400).json({
        success: false,
        message: `不安全的網址: ${safetyCheck.reason}`
      });
    }

    // 檢查自訂域名權限
    let customDomain = null;
    if (customDomainId) {
      const domains = await db.select()
        .from(customDomainsTable)
        .where(and(
          eq(customDomainsTable.id, customDomainId),
          eq(customDomainsTable.userId, userId),
          eq(customDomainsTable.isActive, true)
        ))
        .limit(1);

      if (domains.length === 0) {
        return res.status(403).json({
          success: false,
          message: '無效的自訂域名或無使用權限'
        });
      }
      customDomain = domains[0];
    }

    // 生成唯一的 shortId
    const shortId = await generateUniqueShortId();

    // 獲取網頁標題（如果沒有提供）
    const finalTitle = title || await getUrlTitle(urlValidation.url);

    // 創建短網址記錄
    const newUrl = await db.insert(urlsTable).values({
      userId,
      shortId,
      customDomainId: customDomainId || null,
      originalUrl: urlValidation.url,
      title: finalTitle,
      clickCount: 0,
      isActive: true
    }).returning();

    // 扣除用戶配額
    await db.update(userQuotasTable)
      .set({
        usedQuota: sql`used_quota + 1`,
        remainingQuota: sql`remaining_quota - 1`
      })
      .where(eq(userQuotasTable.userId, userId));

    // 建構短網址
    const shortUrl = buildShortUrl(shortId, customDomain?.domain);

    res.status(201).json({
      success: true,
      message: '短網址創建成功',
      data: {
        id: newUrl[0].id,
        shortId: shortId,
        shortUrl: shortUrl,
        originalUrl: urlValidation.url,
        title: finalTitle,
        customDomain: customDomain?.domain || null,
        clickCount: 0,
        createdAt: newUrl[0].createdAt
      },
      quota: {
        remaining: quota[0].remainingQuota - 1,
        total: quota[0].totalQuota
      }
    });

  } catch (error) {
    console.error('[URL] 創建短網址失敗:', error);
    res.status(500).json({
      success: false,
      message: '創建短網址失敗，請稍後再試'
    });
  }
};

// 取得用戶的短網址列表
const getUserUrls = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

    // 查詢短網址列表
    const urls = await db.select({
      id: urlsTable.id,
      shortId: urlsTable.shortId,
      originalUrl: urlsTable.originalUrl,
      title: urlsTable.title,
      clickCount: urlsTable.clickCount,
      customDomain: customDomainsTable.domain,
      createdAt: urlsTable.createdAt,
      expiresAt: urlsTable.expiresAt,
      isActive: urlsTable.isActive
    })
    .from(urlsTable)
    .leftJoin(customDomainsTable, eq(urlsTable.customDomainId, customDomainsTable.id))
    .where(and(
      eq(urlsTable.userId, userId),
      eq(urlsTable.isActive, true)
    ))
    .orderBy(desc(urlsTable.createdAt))
    .limit(limit)
    .offset(offset);

    // 計算總數
    const totalCount = await db.select({ 
      count: sql`count(*)` 
    })
    .from(urlsTable)
    .where(and(
      eq(urlsTable.userId, userId),
      eq(urlsTable.isActive, true)
    ));

    // 為每個 URL 加上完整的短網址
    const urlsWithShortUrl = urls.map(url => ({
      ...url,
      shortUrl: buildShortUrl(url.shortId, url.customDomain)
    }));

    res.json({
      success: true,
      data: urlsWithShortUrl,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount[0].count / limit),
        totalCount: totalCount[0].count,
        limit: limit
      }
    });

  } catch (error) {
    console.error('[URL] 取得短網址列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得短網址列表失敗，請稍後再試'
    });
  }
};

// 取得特定短網址詳情
const getUrlById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const urls = await db.select({
      id: urlsTable.id,
      shortId: urlsTable.shortId,
      originalUrl: urlsTable.originalUrl,
      title: urlsTable.title,
      clickCount: urlsTable.clickCount,
      customDomain: customDomainsTable.domain,
      createdAt: urlsTable.createdAt,
      expiresAt: urlsTable.expiresAt,
      isActive: urlsTable.isActive
    })
    .from(urlsTable)
    .leftJoin(customDomainsTable, eq(urlsTable.customDomainId, customDomainsTable.id))
    .where(and(
      eq(urlsTable.id, id),
      eq(urlsTable.userId, userId),
      eq(urlsTable.isActive, true)
    ))
    .limit(1);

    if (urls.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到該短網址'
      });
    }

    const url = urls[0];
    const shortUrl = buildShortUrl(url.shortId, url.customDomain);

    res.json({
      success: true,
      data: {
        ...url,
        shortUrl
      }
    });

  } catch (error) {
    console.error('[URL] 取得短網址詳情失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得短網址詳情失敗，請稍後再試'
    });
  }
};

// 更新短網址
const updateUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    // 檢查短網址是否存在且屬於當前用戶
    const existingUrls = await db.select()
      .from(urlsTable)
      .where(and(
        eq(urlsTable.id, id),
        eq(urlsTable.userId, userId),
        eq(urlsTable.isActive, true)
      ))
      .limit(1);

    if (existingUrls.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到該短網址'
      });
    }

    // 更新短網址
    await db.update(urlsTable)
      .set({
        title: title || existingUrls[0].title,
        updatedAt: new Date()
      })
      .where(eq(urlsTable.id, id));

    res.json({
      success: true,
      message: '短網址更新成功'
    });

  } catch (error) {
    console.error('[URL] 更新短網址失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新短網址失敗，請稍後再試'
    });
  }
};

export {
  createUrl,
  getUserUrls,
  getUrlById,
  updateUrl
};