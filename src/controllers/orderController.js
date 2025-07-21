import { eq, and } from 'drizzle-orm';
import { db } from '../config/db.js';
import { ordersTable } from '../models/products/ordersTable.js';
import { productsTable } from '../models/products/productsTable.js';
import { generatePaymentFormHTML } from '../services/ecpay/ecpayService.js';

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

export {
  createOrder
};