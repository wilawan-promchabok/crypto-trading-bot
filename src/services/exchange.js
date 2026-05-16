import ccxt from 'ccxt';

const exchange = new ccxt.binance({ enableRateLimit: true });

// ─── TTL Cache ────────────────────────────────────────────────────────────────
const cache = new Map();
const TICKER_TTL = 60_000;   // 60s
const OHLCV_TTL  = 90_000;   // 90s

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.value;
}

function cacheSet(key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

// ─── Symbol validation ────────────────────────────────────────────────────────
let marketsCache = null;

export async function validateSymbol(symbol) {
  if (!marketsCache) {
    marketsCache = await exchange.loadMarkets();
  }
  return Object.prototype.hasOwnProperty.call(marketsCache, symbol);
}

/**
 * ดึงราคาปัจจุบัน + 24h change
 * @param {string} symbol เช่น 'BTC/USDT'
 */
export async function fetchTicker(symbol) {
  const key = `ticker:${symbol}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const ticker = await exchange.fetchTicker(symbol);
  const result = {
    symbol,
    price: ticker.last,
    change24h: ticker.percentage,
    high24h: ticker.high,
    low24h: ticker.low,
    volume: ticker.baseVolume,
  };
  cacheSet(key, result, TICKER_TTL);
  return result;
}

/**
 * ดึง OHLCV สำหรับคำนวณ indicator
 * @param {string} symbol เช่น 'BTC/USDT'
 * @param {string} timeframe เช่น '1h', '4h'
 * @param {number} limit จำนวน candle
 */
export async function fetchOHLCV(symbol, timeframe = '1h', limit = 100) {
  const key = `ohlcv:${symbol}:${timeframe}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
  const result = ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
    timestamp, open, high, low, close, volume,
  }));
  cacheSet(key, result, OHLCV_TTL);
  return result;
}
