import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// 綠界設定
const ECPAY_CONFIG = {
  // 測試環境
  HOST: process.env.ECPAY_SERVICE_URL || 'https://payment-stage.ecpay.com.tw',
  MERCHANT_ID: process.env.ECPAY_MERCHANT_ID || '2000132',
  HASH_KEY: process.env.ECPAY_HASH_KEY || '5294y06JbISpM5x9',
  HASH_IV: process.env.ECPAY_HASH_IV || 'v77hoKGq4kWxNNIS',
  
  // 固定參數
  PAYMENT_TYPE: 'aio',
  CHOOSE_PAYMENT: 'Credit',
  ENCRYPT_TYPE: 1
};

// 生成 CheckMacValue
const generateCheckMacValue = (params, hashKey, hashIV) => {
  const sortedKeys = Object.keys(params).sort((a, b) => 
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  
  const queryString = sortedKeys
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const rawString = `HashKey=${hashKey}&${queryString}&HashIV=${hashIV}`;
  
  const encodedString = encodeURIComponent(rawString)
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  
  const md5Hash = crypto.createHash('md5')
    .update(encodedString.toLowerCase())
    .digest('hex');
  
  return md5Hash.toUpperCase();
};

// 驗證回傳的 CheckMacValue
const verifyCheckMacValue = (params, receivedMac) => {
  const { CheckMacValue, ...paramsWithoutMac } = params;
  
  const calculatedMac = generateCheckMacValue(
    paramsWithoutMac, 
    ECPAY_CONFIG.HASH_KEY, 
    ECPAY_CONFIG.HASH_IV
  );
  
  return calculatedMac === receivedMac;
};

// 建立綠界付款表單參數
const createPaymentForm = (orderData) => {
  try {
    const {
      orderNumber,
      totalAmount,
      itemName,
      returnUrl,
      clientBackUrl,
      orderResultUrl
    } = orderData;

    const params = {
      MerchantID: ECPAY_CONFIG.MERCHANT_ID,
      MerchantTradeNo: orderNumber,
      MerchantTradeDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
      PaymentType: ECPAY_CONFIG.PAYMENT_TYPE,
      TotalAmount: totalAmount,
      TradeDesc: '短網址服務付款',
      ItemName: itemName,
      ReturnURL: returnUrl,
      ChoosePayment: ECPAY_CONFIG.CHOOSE_PAYMENT,
      EncryptType: ECPAY_CONFIG.ENCRYPT_TYPE
    };

    if (clientBackUrl) {
      params.ClientBackURL = clientBackUrl;
    }
    
    if (orderResultUrl) {
      params.OrderResultURL = orderResultUrl;
    }

    params.CheckMacValue = generateCheckMacValue(
      params,
      ECPAY_CONFIG.HASH_KEY,
      ECPAY_CONFIG.HASH_IV
    );

    return {
      success: true,
      action: `${ECPAY_CONFIG.HOST}/Cashier/AioCheckOut/V5`,
      params: params
    };

  } catch (error) {
    console.error('[ECPAY] 建立付款表單失敗:', error);
    return {
      success: false,
      error: 'PAYMENT_FORM_CREATION_FAILED',
      message: '建立付款表單失敗'
    };
  }
};

// 產生 HTML 表單
const generatePaymentFormHTML = (orderData) => {
  const formResult = createPaymentForm(orderData);
  
  if (!formResult.success) {
    return formResult;
  }

  const { action, params } = formResult;
  
  const hiddenFields = Object.entries(params)
    .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}">`)
    .join('\n    ');

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>付款處理中...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background-color: #f5f5f5;
        }
        .payment-form {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
            margin: 0 auto;
        }
        .loading {
            color: #666;
            margin-bottom: 20px;
        }
        .btn {
            background-color: #007bff;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        .btn:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <div class="payment-form">
        <h2>正在前往付款頁面...</h2>
        <p class="loading">請稍候，系統正在處理您的付款請求</p>
        
        <form id="ecpayForm" method="post" action="${action}">
            ${hiddenFields}
            <button type="submit" class="btn">
                如果沒有自動跳轉，請點此繼續付款
            </button>
        </form>
    </div>

    <script>
        // 自動提交表單
        setTimeout(function() {
            document.getElementById('ecpayForm').submit();
        }, 1000);
    </script>
</body>
</html>`;

  return {
    success: true,
    html: html,
    action: action,
    params: params
  };
};

// 處理綠界回傳結果
const verifyEcpayCallback = (callbackData) => {
  try {
    console.log('[ECPAY] 收到付款回調:', callbackData);

    const isValid = verifyCheckMacValue(callbackData, callbackData.CheckMacValue);
    
    if (!isValid) {
      console.error('[ECPAY] CheckMacValue 驗證失敗');
      return {
        success: false,
        error: 'INVALID_CHECKMACVALUE',
        message: 'CheckMacValue 驗證失敗'
      };
    }

    const result = {
      merchantTradeNo: callbackData.MerchantTradeNo,
      ecpayTradeNo: callbackData.TradeNo,
      paymentDate: callbackData.PaymentDate,
      paymentType: callbackData.PaymentType,
      totalAmount: parseInt(callbackData.TradeAmt),
      simulatePaid: parseInt(callbackData.SimulatePaid || 0),
      rtnCode: callbackData.RtnCode,
      rtnMsg: callbackData.RtnMsg,
      checkMacValue: callbackData.CheckMacValue
    };

    const isSuccess = callbackData.RtnCode === '1' || callbackData.SimulatePaid === '1';

    return {
      success: isSuccess,
      result: result,
      message: isSuccess ? '付款成功' : `付款失敗: ${callbackData.RtnMsg}`
    };

  } catch (error) {
    console.error('[ECPAY] 處理付款回調失敗:', error);
    return {
      success: false,
      error: 'CALLBACK_PROCESSING_FAILED',
      message: '處理付款回調失敗'
    };
  }
};

// 測試模式的模擬付款
const simulatePayment = (orderNumber, amount) => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('模擬付款僅限開發環境使用');
  }

  return {
    success: true,
    result: {
      merchantTradeNo: orderNumber,
      ecpayTradeNo: `TEST${Date.now()}`,
      paymentDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
      paymentType: 'Credit_CreditCard',
      totalAmount: amount,
      simulatePaid: 1,
      rtnCode: '1',
      rtnMsg: '交易成功',
      checkMacValue: 'TEST_MAC_VALUE'
    },
    message: '模擬付款成功'
  };
};

export {
  createPaymentForm,
  generatePaymentFormHTML,
  verifyEcpayCallback,
  verifyCheckMacValue,
  simulatePayment,
  ECPAY_CONFIG
};