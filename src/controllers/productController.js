import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { productsTable } from '../models/products/productsTable.js';

// 取得所有啟用的商品
const getProducts = async (req, res) => {
  try {
    const products = await db.select({
      id: productsTable.id,
      name: productsTable.name,
      description: productsTable.description,
      quotaAmount: productsTable.quotaAmount,
      price: productsTable.price,
      productType: productsTable.productType,
      subscriptionDurationDays: productsTable.subscriptionDurationDays,
      createdAt: productsTable.createdAt
    })
    .from(productsTable)
    .where(eq(productsTable.isActive, true))
    .orderBy(productsTable.productType, productsTable.price);

    // 格式化價格顯示
    const formattedProducts = products.map(product => ({
      ...product,
      priceDisplay: `$${(product.price / 100).toFixed(2)}`,
      features: getProductFeatures(product)
    }));

    res.json({
      success: true,
      data: formattedProducts,
      message: '商品列表取得成功'
    });

  } catch (error) {
    console.error('[PRODUCT] 取得商品列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得商品列表失敗，請稍後再試'
    });
  }
};

// 取得特定商品詳情
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const products = await db.select()
      .from(productsTable)
      .where(and(
        eq(productsTable.id, id),
        eq(productsTable.isActive, true)
      ))
      .limit(1);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到該商品'
      });
    }

    const product = products[0];

    res.json({
      success: true,
      data: {
        ...product,
        priceDisplay: `$${(product.price / 100).toFixed(2)}`,
        features: getProductFeatures(product)
      },
      message: '商品詳情取得成功'
    });

  } catch (error) {
    console.error('[PRODUCT] 取得商品詳情失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得商品詳情失敗，請稍後再試'
    });
  }
};

// 創建商品（管理員）
const createProduct = async (req, res) => {
  try {
    const { name, description, quotaAmount, price, productType, subscriptionDurationDays } = req.body;

    // 驗證必要欄位
    if (!name || !description || price === undefined || !productType) {
      return res.status(400).json({
        success: false,
        message: '請提供所有必要欄位：name, description, price, productType'
      });
    }

    // 驗證商品類型
    const validTypes = ['quota', 'custom_domain', 'custom_domain_yearly'];
    if (!validTypes.includes(productType)) {
      return res.status(400).json({
        success: false,
        message: '無效的商品類型'
      });
    }

    // 驗證價格
    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: '價格不能為負數'
      });
    }

    // 建立商品
    const newProduct = await db.insert(productsTable).values({
      name,
      description,
      quotaAmount: quotaAmount || 0,
      price,
      productType,
      subscriptionDurationDays: subscriptionDurationDays || null,
      isActive: true
    }).returning();

    res.status(201).json({
      success: true,
      data: newProduct[0],
      message: '商品創建成功'
    });

  } catch (error) {
    console.error('[PRODUCT] 創建商品失敗:', error);
    res.status(500).json({
      success: false,
      message: '創建商品失敗，請稍後再試'
    });
  }
};

// 更新商品（管理員）
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, quotaAmount, price, productType, isActive, subscriptionDurationDays } = req.body;

    // 檢查商品是否存在
    const [existingProducts] = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .limit(1);

    if (!existingProducts) {
      return res.status(404).json({
        success: false,
        message: '找不到該商品'
      });
    }

    // 準備更新資料
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (quotaAmount !== undefined) updateData.quotaAmount = quotaAmount;
    if (price !== undefined) updateData.price = price;
    if (productType !== undefined) updateData.productType = productType;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (subscriptionDurationDays !== undefined) updateData.subscriptionDurationDays = subscriptionDurationDays;
    updateData.updatedAt = new Date();

    // 更新商品
    await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, id));

    res.json({
      success: true,
      message: '商品更新成功'
    });

  } catch (error) {
    console.error('[PRODUCT] 更新商品失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新商品失敗，請稍後再試'
    });
  }
};

export {
  getProducts,
  getProductById,
  createProduct,
  updateProduct
};