import { db } from '../../config/db.js';
import { productsTable } from '../../models/products/productsTable.js';

// 預設商品數據
const defaultProducts = [
  {
    name: '基礎包',
    description: '增加10次短網址使用額度',
    quotaAmount: 10,
    price: 1000,
    productType: 'quota',
    subscriptionDurationDays: null,
    isActive: true
  },
  {
    name: '超值包',
    description: '增加100次短網址使用額度',
    quotaAmount: 100,
    price: 9000,
    productType: 'quota',
    subscriptionDurationDays: null,
    isActive: true
  },
  {
    name: '自訂網域',
    description: '啟用自訂網域功能（月費）',
    quotaAmount: 0,
    price: 9900,
    productType: 'custom_domain',
    subscriptionDurationDays: 30,
    isActive: true
  },
  {
    name: '自訂網域年費',
    description: '啟用自訂網域功能（年費）',
    quotaAmount: 0,
    price: 99900,
    productType: 'custom_domain_yearly',
    subscriptionDurationDays: 365,
    isActive: true
  }
];

// 初始化商品數據
const seedProducts = async () => {
  try {
    console.log('[SEED] 開始初始化商品數據...');

    const existingProducts = await db.select().from(productsTable);
    
    if (existingProducts.length > 0) {
      console.log('[SEED] 商品數據已存在，跳過初始化');
      return {
        success: true,
        message: '商品數據已存在',
        count: existingProducts.length
      };
    }
    
    const insertedProducts = await db.insert(productsTable).values(defaultProducts).returning();
    
    console.log(`[SEED] 成功初始化 ${insertedProducts.length} 個商品`);
    
    return {
      success: true,
      message: '商品數據初始化成功',
      count: insertedProducts.length,
      products: insertedProducts
    };
    
  } catch (error) {
    console.error('[SEED] 商品數據初始化失敗:', error);
    return {
      success: false,
      message: '商品數據初始化失敗',
      error: error.message
    };
  }
};

// 重設商品數據
const resetProducts = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生產環境不允許重設商品數據');
  }
  
  try {
    console.log('[SEED] 開始重設商品數據...');
    
    await db.delete(productsTable);
    
    const insertedProducts = await db.insert(productsTable).values(defaultProducts).returning();
    
    console.log(`[SEED] 成功重設 ${insertedProducts.length} 個商品`);
    
    return {
      success: true,
      message: '商品數據重設成功',
      count: insertedProducts.length,
      products: insertedProducts
    };
    
  } catch (error) {
    console.error('[SEED] 商品數據重設失敗:', error);
    return {
      success: false,
      message: '商品數據重設失敗',
      error: error.message
    };
  }
};

// 檢查商品數據完整性
const checkProductIntegrity = async () => {
  try {
    const products = await db.select().from(productsTable);
    const productTypes = ['quota', 'custom_domain', 'custom_domain_yearly'];
    
    const issues = [];
    
    for (const type of productTypes) {
      const hasType = products.some(p => p.productType === type);
      if (!hasType) {
        issues.push(`缺少商品類型: ${type}`);
      }
    }
    
    for (const product of products) {
      if (product.price < 0) {
        issues.push(`商品 ${product.name} 價格為負數`);
      }
    }
    
    const quotaProducts = products.filter(p => p.productType === 'quota');
    for (const product of quotaProducts) {
      if (product.quotaAmount <= 0) {
        issues.push(`配額商品 ${product.name} 配額數量無效`);
      }
    }
    
    return {
      success: issues.length === 0,
      totalProducts: products.length,
      activeProducts: products.filter(p => p.isActive).length,
      issues: issues
    };
    
  } catch (error) {
    console.error('[SEED] 商品數據檢查失敗:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export {
  seedProducts,
  resetProducts,
  checkProductIntegrity,
  defaultProducts
};