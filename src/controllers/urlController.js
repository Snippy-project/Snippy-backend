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

    if (!originalUrl) {
      return res.status(400).json({
        success: false,
        message: '請提供原始網址'
      });
    }

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

    const urlValidation = validateUrl(originalUrl);
    if (!urlValidation.valid) {
      return res.status(400).json({
        success: false,
        message: urlValidation.error
      });
    }

    const safetyCheck = checkUrlSafety(urlValidation.url);
    if (!safetyCheck.safe) {
      return res.status(400).json({
        success: false,
        message: `不安全的網址: ${safetyCheck.reason}`
      });
    }

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

    // 生成 shortId
    const shortId = await generateUniqueShortId();

    const finalTitle = title || await getUrlTitle(urlValidation.url);

    // 創建短網址
    const newUrl = await db.insert(urlsTable).values({
      userId,
      shortId,
      customDomainId: customDomainId || null,
      originalUrl: urlValidation.url,
      title: finalTitle,
      clickCount: 0,
      isActive: true
    }).returning();

    // 扣除額度
    await db.update(userQuotasTable)
      .set({
        usedQuota: sql`used_quota + 1`,
        remainingQuota: sql`remaining_quota - 1`
      })
      .where(eq(userQuotasTable.userId, userId));

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

// 取得用戶的短網址
const getUserUrls = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;

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

    const totalCount = await db.select({ 
      count: sql`count(*)` 
    })
    .from(urlsTable)
    .where(and(
      eq(urlsTable.userId, userId),
      eq(urlsTable.isActive, true)
    ));

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

// 取得特定短網址
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

// 刪除短網址（軟刪除）
const deleteUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

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

    await db.update(urlsTable)
      .set({
        isActive: false
      })
      .where(eq(urlsTable.id, id));

    res.json({
      success: true,
      message: '短網址刪除成功'
    });

  } catch (error) {
    console.error('[URL] 刪除短網址失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除短網址失敗，請稍後再試'
    });
  }
};

// 短網址重導
const handleRedirect = async (req, res) => {
  try {
    const { shortId } = req.params;

    const urls = await db.select()
      .from(urlsTable)
      .where(and(
        eq(urlsTable.shortId, shortId),
        eq(urlsTable.isActive, true)
      ))
      .limit(1);

    if (urls.length === 0) {
      return res.status(404).json({
        success: false,
        message: '短網址不存在或已失效'
      });
    }

    const url = urls[0];

    if (url.expiresAt && new Date() > url.expiresAt) {
      return res.status(410).json({
        success: false,
        message: '短網址已過期'
      });
    }

    // 更新點擊次數
    await db.update(urlsTable)
      .set({
        clickCount: sql`click_count + 1`
      })
      .where(eq(urlsTable.id, url.id));

    res.redirect(301, url.originalUrl);

  } catch (error) {
    console.error('[URL] 短網址重導失敗:', error);
    res.status(500).json({
      success: false,
      message: '重導失敗，請稍後再試'
    });
  }
};

export {
  createUrl,
  getUserUrls,
  getUrlById,
  updateUrl,
  deleteUrl,
  handleRedirect
};