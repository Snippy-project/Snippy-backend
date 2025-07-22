# 短網址服務 - 後端 API

專業的短網址服務後端系統，提供完整的短網址管理、用戶認證、付款整合等功能。

## 🚀 快速開始

### 環境要求
- Node.js 18+
- MySQL 8.0+

### 安裝和運行

```bash
# 1. 克隆專案

# 2. 安裝依賴
npm install

# 3. 複製環境變數
cp .env.example .env

# 4. 配置環境變數
.env

# 5. 初始化資料庫

# 6. 啟動開發服務器
npm run dev

# 7. 生產環境運行
npm start
```

服務器將在 `http://localhost:3000` 啟動

```

## 📚 API 文檔

### 認證相關
```
POST   /api/auth/register           # 用戶註冊
POST   /api/auth/login              # 用戶登入
POST   /api/auth/logout             # 用戶登出
POST   /api/auth/verify-email       # 驗證信箱
POST   /api/auth/forgot-password    # 忘記密碼
POST   /api/auth/reset-password     # 重設密碼
```

### 短網址管理
```
GET    /api/urls                    # 取得短網址列表
POST   /api/urls                    # 創建短網址
GET    /api/urls/:id                # 取得短網址詳情
PUT    /api/urls/:id                # 更新短網址
DELETE /api/urls/:id                # 刪除短網址
GET    /redirect/:shortCode         # 短網址重定向
```

### 用戶管理
```
GET    /api/users/profile           # 取得用戶資料
PUT    /api/users/profile           # 更新用戶資料
GET    /api/users/quota             # 取得配額信息
GET    /api/users/domains           # 取得可用域名
```

### 自訂域名
```
GET    /api/domains                 # 取得域名列表
POST   /api/domains                 # 添加域名
POST   /api/domains/:id/verify      # 驗證域名
DELETE /api/domains/:id             # 刪除域名
```

### 商品和訂單
```
GET    /api/products                # 取得商品列表
GET    /api/orders                  # 取得訂單列表
POST   /api/orders                  # 創建訂單
GET    /api/orders/:id              # 取得訂單詳情
GET    /api/orders/:id/payment      # 跳轉付款頁面
POST   /api/payment/callback        # 付款回調處理
```

## 🗄️ 資料庫結構

### 主要資料表
- `users` - 用戶資料
- `urls` - 短網址記錄
- `domains` - 自訂域名
- `products` - 商品資料
- `orders` - 訂單記錄
- `subscriptions` - 訂閱記錄
- `url_stats` - 點擊統計

## 🏗️ 專案結構

```
src/
├── controllers/     # 控制器
├── middleware/      # 中介軟體
├── models/         # 資料模型
├── routes/         # 路由定義
├── services/       # 業務邏輯
├── utils/          # 工具函數
├── config/         # 配置文件
└── drizzle/     # 資料庫遷移
```
