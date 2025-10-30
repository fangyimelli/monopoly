# 地產大亨遊戲 - 部署指南

## 📁 文件結構說明

經過重新組織後，項目的文件結構如下：

```
monopoly/
├── index.html              # 主頁面（根目錄）
├── public/                 # 靜態資源文件夾
│   ├── css/
│   │   └── styles.css      # 樣式文件
│   └── js/                 # JavaScript 文件
│       ├── board.js        # 遊戲棋盤邏輯
│       ├── game.js         # 主要遊戲邏輯
│       ├── main.js         # 主程序入口
│       ├── question-system.js  # 問答系統
│       └── ui.js           # UI 管理
├── server/                 # 服務器端文件
│   └── GameManager.js      # 遊戲管理器
├── server.js               # 主服務器文件
├── package.json            # 依賴配置
└── package-lock.json       # 依賴鎖定文件
```

## 🚀 部署到網域的步驟

### 1. 準備部署文件

確保以下文件都在項目根目錄：
- ✅ `index.html` - 主頁面
- ✅ `server.js` - 服務器文件
- ✅ `package.json` - 依賴配置
- ✅ `public/` 文件夾 - 包含所有靜態資源
- ✅ `server/` 文件夾 - 包含服務器邏輯

### 2. 環境變量設置

在部署平台設置以下環境變量：
```
PORT=3000  # 或者您的平台指定的端口
NODE_ENV=production
```

### 3. 部署到不同平台

#### A. Heroku 部署
1. 創建 `Procfile` 文件：
```
web: node server.js
```

2. 確保 `package.json` 中有正確的 scripts：
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

3. 部署命令：
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

#### B. Vercel 部署
1. 創建 `vercel.json` 文件：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ]
}
```

#### C. Railway 部署
1. 連接 GitHub 倉庫
2. 設置環境變量
3. 自動部署

#### D. 自己的 VPS 部署
1. 上傳文件到服務器
2. 安裝 Node.js 和 npm
3. 運行：
```bash
npm install
npm start
```

### 4. 域名配置

如果使用自定義域名：
1. 設置 DNS A 記錄指向服務器 IP
2. 配置 SSL 證書（推薦使用 Let's Encrypt）
3. 設置反向代理（如使用 Nginx）

### 5. 生產環境優化

#### A. 安全設置
```javascript
// 在 server.js 中添加
const helmet = require('helmet');
app.use(helmet());
```

#### B. 壓縮設置
```javascript
const compression = require('compression');
app.use(compression());
```

#### C. 日誌設置
```javascript
const morgan = require('morgan');
app.use(morgan('combined'));
```

## 🔧 重要修改說明

### 1. 文件路徑更新
- `index.html` 現在在根目錄
- CSS 路徑：`public/css/styles.css`
- JS 路徑：`public/js/*.js`

### 2. 服務器配置更新
```javascript
// 提供根目錄的靜態文件
app.use(express.static(__dirname));

// 默認路由到 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
```

### 3. Socket.io 配置
Socket.io 路徑保持不變：`/socket.io/socket.io.js`

## 📋 部署檢查清單

- [ ] `index.html` 在根目錄
- [ ] 所有靜態資源路徑正確
- [ ] `package.json` 包含所有依賴
- [ ] 環境變量設置正確
- [ ] 端口配置適合部署平台
- [ ] Socket.io 連接正常
- [ ] 遊戲功能測試通過

## 🐛 常見問題

### Q: 部署後頁面無法載入
A: 檢查服務器是否正確提供靜態文件，確認路徑設置

### Q: Socket.io 連接失敗
A: 檢查 CORS 設置和 WebSocket 支持

### Q: 遊戲功能異常
A: 檢查控制台錯誤，確認所有 JS 文件正確載入

## 📞 技術支持

如果遇到部署問題，請檢查：
1. 服務器日誌
2. 瀏覽器控制台錯誤
3. 網絡連接狀態
4. 文件權限設置
