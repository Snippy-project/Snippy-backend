import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { ordersTable } from '../models/products/ordersTable.js';
import { productsTable } from '../models/products/productsTable.js';
import { userQuotasTable } from '../models/users/userQuotasTable.js';
import { userSubscriptionsTable } from '../models/users/userSubscriptionsTable.js';
import { generatePaymentFormHTML, verifyEcpayCallback, simulatePayment } from '../services/ecpay/ecpayService.js';

// 創建訂單
const createOrder = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    // 驗證必要欄位
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: '請選擇要購買的商品'
      });
    }

    // 查詢商品資訊
    const products = await db.select()
      .from(productsTable)
      .where(and(
        eq(productsTable.id, productId),
        eq(productsTable.isActive, true)
      ))
      .limit(1);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到該商品或商品已下架'
      });
    }

    const product = products[0];

    // 生成訂單編號
    const orderNumber = `ORDER-${Date.now()}-${userId}`;

    // 建立訂單
    const newOrder = await db.insert(ordersTable).values({
      userId,
      productId,
      orderNumber,
      price: product.price,
      orderStatus: 'pending'
    }).returning();

    const order = newOrder[0];

    // 準備付款資料
    const paymentData = {
      orderNumber: orderNumber,
      totalAmount: product.price,
      itemName: product.name,
      returnUrl: `${process.env.BACKEND_URL}/api/orders/payment/callback`,
      clientBackUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`,
      orderResultUrl: `${process.env.FRONTEND_URL}/orders/${order.id}/result`
    };

    // 生成綠界付款表單
    const paymentForm = generatePaymentFormHTML(paymentData);

    if (!paymentForm.success) {
      return res.status(500).json({
        success: false,
        message: '建立付款表單失敗'
      });
    }

    res.status(201).json({
      success: true,
      message: '訂單創建成功',
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          priceDisplay: `$${(product.price / 100).toFixed(2)}`
        },
        paymentUrl: `/api/orders/${order.id}/payment`,
        status: order.orderStatus,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('[ORDER] 創建訂單失敗:', error);
    res.status(500).json({
      success: false,
      message: '創建訂單失敗，請稍後再試'
    });
  }
};

// 取得付款頁面
const getPaymentPage = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    // 查詢訂單
    const orders = await db.select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      price: ordersTable.price,
      orderStatus: ordersTable.orderStatus,
      productName: productsTable.name,
      productDescription: productsTable.description
    })
    .from(ordersTable)
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(and(
      eq(ordersTable.id, orderId),
      eq(ordersTable.userId, userId)
    ))
    .limit(1);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到該訂單'
      });
    }

    const order = orders[0];

    // 檢查訂單狀態
    if (order.orderStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '訂單狀態不允許付款',
        status: order.orderStatus
      });
    }

    // 準備付款資料
    const paymentData = {
      orderNumber: order.orderNumber,
      totalAmount: order.price,
      itemName: order.productName,
      returnUrl: `${process.env.BACKEND_URL}/api/orders/payment/callback`,
      clientBackUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`,
      orderResultUrl: `${process.env.FRONTEND_URL}/orders/${order.id}/result`
    };

    // 生成綠界付款表單
    const paymentForm = generatePaymentFormHTML(paymentData);

    if (!paymentForm.success) {
      return res.status(500).json({
        success: false,
        message: '建立付款表單失敗'
      });
    }

    // 回傳 HTML 付款頁面
    res.setHeader('Content-Type', 'text/html');
    res.send(paymentForm.html);

  } catch (error) {
    console.error('[ORDER] 取得付款頁面失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得付款頁面失敗，請稍後再試'
    });
  }
};

// 處理綠界付款回調
const handlePaymentCallback = async (req, res) => {
  try {
    console.log('[ORDER] 收到綠界付款回調');
    
    // 處理綠界回傳資料
    const callbackResult = verifyEcpayCallback(req.body);
    
    if (!callbackResult.success) {
      console.error('[ORDER] 付款回調處理失敗:', callbackResult.message);
      return res.send('0|Error');
    }

    const { result } = callbackResult;
    const { merchantTradeNo } = result;

    // 查詢對應的訂單
    const orders = await db.select()
      .from(ordersTable)
      .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
      .where(eq(ordersTable.orderNumber, merchantTradeNo))
      .limit(1);

    if (orders.length === 0) {
      console.error('[ORDER] 找不到對應的訂單:', merchantTradeNo);
      return res.send('0|Order not found');
    }

    const order = orders[0].orders;
    const product = orders[0].products;

    // 更新訂單狀態
    if (callbackResult.success) {
      await db.update(ordersTable)
        .set({
          orderStatus: 'paid',
          ecpayTradeNo: result.ecpayTradeNo,
          ecpayPaymentDate: new Date(result.paymentDate),
          ecpaySimulatePaid: result.simulatePaid,
          ecpayCheckMacValue: result.checkMacValue,
          paidAt: new Date()
        })
        .where(eq(ordersTable.id, order.id));

      // 處理訂單完成後的業務邏輯
      await processOrderCompletion(order, product);

      console.log('[ORDER] 訂單付款成功:', merchantTradeNo);
      res.send('1|OK');
    } else {
      await db.update(ordersTable)
        .set({
          orderStatus: 'failed',
          failureReason: result.rtnMsg,
          ecpayCheckMacValue: result.checkMacValue
        })
        .where(eq(ordersTable.id, order.id));

      console.log('[ORDER] 訂單付款失敗:', merchantTradeNo, result.rtnMsg);
      res.send('1|OK');
    }

  } catch (error) {
    console.error('[ORDER] 付款回調處理異常:', error);
    res.send('0|Exception');
  }
};

// 處理訂單完成後的業務邏輯
const processOrderCompletion = async (order, product) => {
  try {
    console.log('[ORDER] 開始處理訂單完成邏輯:', order.orderNumber);

    if (product.productType === 'quota') {
      // 配額商品：增加用戶配額
      await db.update(userQuotasTable)
        .set({
          totalQuota: sql`total_quota + ${product.quotaAmount}`,
          remainingQuota: sql`remaining_quota + ${product.quotaAmount}`
        })
        .where(eq(userQuotasTable.userId, order.userId));

      console.log(`[ORDER] 用戶 ${order.userId} 增加配額 ${product.quotaAmount}`);

    } else if (product.productType === 'custom_domain' || product.productType === 'custom_domain_yearly') {
      // 自訂域名商品：創建訂閱記錄
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + product.subscriptionDurationDays);

      await db.insert(userSubscriptionsTable).values({
        userId: order.userId,
        subscriptionType: product.productType,
        subscriptionStatus: 'active',
        startDate: new Date(),
        endDate: endDate
      });

      console.log(`[ORDER] 用戶 ${order.userId} 開啟訂閱 ${product.productType}`);
    }

  } catch (error) {
    console.error('[ORDER] 處理訂單完成邏輯失敗:', error);
    // 這裡可以加入重試機制或告警
  }
};

// 取得用戶訂單列表
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 查詢訂單列表
    const orders = await db.select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      price: ordersTable.price,
      orderStatus: ordersTable.orderStatus,
      paidAt: ordersTable.paidAt,
      createdAt: ordersTable.createdAt,
      productName: productsTable.name,
      productDescription: productsTable.description,
      productType: productsTable.productType
    })
    .from(ordersTable)
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(eq(ordersTable.userId, userId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

    // 計算總數
    const totalCount = await db.select({ 
      count: sql`count(*)` 
    })
    .from(ordersTable)
    .where(eq(ordersTable.userId, userId));

    // 格式化訂單資料
    const formattedOrders = orders.map(order => ({
      ...order,
      priceDisplay: `$${(order.price / 100).toFixed(2)}`,
      statusText: getOrderStatusText(order.orderStatus)
    }));

    res.json({
      success: true,
      data: formattedOrders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount[0].count / limit),
        totalCount: totalCount[0].count,
        limit: limit
      }
    });

  } catch (error) {
    console.error('[ORDER] 取得訂單列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得訂單列表失敗，請稍後再試'
    });
  }
};

// 取得特定訂單詳情
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const orders = await db.select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      price: ordersTable.price,
      orderStatus: ordersTable.orderStatus,
      ecpayTradeNo: ordersTable.ecpayTradeNo,
      ecpayPaymentDate: ordersTable.ecpayPaymentDate,
      failureReason: ordersTable.failureReason,
      paidAt: ordersTable.paidAt,
      createdAt: ordersTable.createdAt,
      productName: productsTable.name,
      productDescription: productsTable.description,
      productType: productsTable.productType,
      quotaAmount: productsTable.quotaAmount
    })
    .from(ordersTable)
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(and(
      eq(ordersTable.id, orderId),
      eq(ordersTable.userId, userId)
    ))
    .limit(1);

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到該訂單'
      });
    }

    const order = orders[0];

    res.json({
      success: true,
      data: {
        ...order,
        priceDisplay: `$${(order.price / 100).toFixed(2)}`,
        statusText: getOrderStatusText(order.orderStatus),
        canPay: order.orderStatus === 'pending',
        paymentUrl: order.orderStatus === 'pending' ? `/api/orders/${order.id}/payment` : null
      }
    });

  } catch (error) {
    console.error('[ORDER] 取得訂單詳情失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得訂單詳情失敗，請稍後再試'
    });
  }
};

export {
  createOrder,
  getPaymentPage,
  handlePaymentCallback,
  getUserOrders,
  getOrderById
};