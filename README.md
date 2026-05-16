# 🤖 Crypto Discord Bot

Discord bot สำหรับติดตามราคา crypto และสัญญาณ technical analysis แบบ real-time ดึงข้อมูลจาก Binance ผ่าน CCXT

---

## ✨ ฟีเจอร์

- 📊 วิเคราะห์ 4 indicators: **RSI**, **EMA Cross**, **MACD**, **Elliott Wave**
- 📐 แสดง **Bollinger Bands** เพิ่มเติม
- 🔔 ส่ง alert อัตโนมัติตาม cron schedule
- 🧠 **Alert deduplication** — ส่งเฉพาะเมื่อสัญญาณเปลี่ยน
- 💾 **Watchlist persistent** — บันทึกลงไฟล์ ไม่หายตอน restart
- ⚡ **Response caching** — ลด Binance API calls
- 🏥 **Health endpoint** + self-ping กัน Render spin down

---

## 🛠 คำสั่ง Slash Commands

### `/price`
ดูราคาและสัญญาณ indicator ของ crypto

| Option | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `symbol` | ชื่อ coin | `BTC` หรือ `BTC/USDT` |
| `timeframe` | ช่วงเวลา (default: 1h) | `15m`, `1h`, `4h`, `1d` |

```
/price symbol: BTC timeframe: 4h
```

---

### `/watch`
จัดการ watchlist สำหรับ alert อัตโนมัติ

| Subcommand | คำอธิบาย |
|-----------|----------|
| `add` | เพิ่ม coin เข้า watchlist (ตรวจ symbol กับ Binance อัตโนมัติ) |
| `remove` | ลบ coin ออกจาก watchlist |
| `list` | ดูรายการทั้งหมดพร้อม threshold ปัจจุบัน |
| `threshold` | ตั้งค่า score ขั้นต่ำสำหรับส่ง alert (1–4) |

```
/watch add symbol: SOL
/watch remove symbol: SHIB
/watch list
/watch threshold value: 3
```

---

### `/ping`
ตรวจสอบ latency ของ bot

```
/ping
→ 🏓 Pong! Roundtrip: 42ms | WebSocket: 38ms
```

---

## 📈 ระบบ Indicators

| Indicator | สัญญาณ BUY | สัญญาณ SELL |
|-----------|-----------|------------|
| RSI (14) | ≤ 30 (Oversold) | ≥ 70 (Overbought) |
| EMA Cross (9/21) | Golden Cross | Death Cross |
| MACD (12/26/9) | MACD ตัดขึ้นเหนือ Signal | MACD ตัดลงใต้ Signal |
| Elliott Wave | Wave 3 Bullish Impulse | Wave 3 Bearish Impulse |

**Consensus score** รวม 4 indicators → `score/4`
- `⚡ Strong BUY/SELL` = 4/4
- `🟢 BUY` / `🔴 SELL` = เสียงข้างมาก
- `⚪ NEUTRAL` = เท่ากัน

---

## ⚙️ Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`:

```env
# Discord
DISCORD_TOKEN=        # Bot token จาก Discord Developer Portal
CLIENT_ID=            # Application ID
GUILD_ID=             # Server ID (สำหรับ deploy commands)

# Alert
ALERT_CHANNEL_ID=     # Channel ID ที่จะส่ง alert
DEFAULT_SYMBOLS=BTC/USDT,ETH/USDT,SOL/USDT

# Scheduler
ALERT_INTERVAL_CRON=*/5 * * * *   # ทุก 5 นาที
ALERT_TIMEFRAME=1h                 # 15m | 1h | 4h | 1d

# Server
PORT=3000
```

---

## 🚀 การติดตั้งและรัน

### Requirements
- Node.js >= 24.0.0

### ติดตั้ง

```bash
npm install
```

### Deploy slash commands (ครั้งแรก)

```bash
# Guild (เฉพาะ server ที่กำหนด — เห็นทันที)
npm run deploy-commands

# Global (ทุก server — ใช้เวลาสูงสุด 1 ชั่วโมง)
npm run deploy-commands -- --global
```

### รัน

```bash
# Production
npm start

# Development (hot reload)
npm run dev
```

---

## ☁️ Deploy บน Render

1. สร้าง **Web Service** บน [render.com](https://render.com)
2. เชื่อมต่อ GitHub repository
3. ตั้งค่า:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. เพิ่ม Environment Variables ทั้งหมดในหน้า Dashboard
5. Bot จะ **self-ping** ทุก 14 นาทีเพื่อกัน spin down อัตโนมัติ

### Health Check

```
GET /health
→ { "status": "ok", "uptime": 3600, "discord": "connected", "ping": 42 }
```

| status | HTTP | ความหมาย |
|--------|------|---------|
| `ok` | 200 | Bot ออนไลน์และเชื่อมต่อ Discord |
| `degraded` | 503 | Process ทำงานแต่ Discord ตัดการเชื่อมต่อ |

---

## 📁 โครงสร้างโปรเจกต์

```
src/
├── index.js              # Entry point
├── bot.js                # Discord event handler
├── client.js             # Discord client instance
├── scheduler.js          # Cron job สำหรับ alert อัตโนมัติ
├── health.js             # Health HTTP server + self-ping
├── deploy-commands.js    # Register slash commands
├── commands/
│   ├── price.js          # /price command
│   ├── watch.js          # /watch command
│   └── ping.js           # /ping command
└── services/
    ├── alerts.js         # วิเคราะห์และส่ง alert
    ├── exchange.js       # Binance API + cache
    ├── indicators.js     # RSI, EMA, MACD, Elliott Wave, Bollinger Bands
    └── storage.js        # บันทึก watchlist และ settings ลงดิสก์
data/                     # ไฟล์ข้อมูล (สร้างอัตโนมัติ)
├── watchlist.json
└── settings.json
```
