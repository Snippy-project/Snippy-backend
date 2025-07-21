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

export {
  getProducts
};