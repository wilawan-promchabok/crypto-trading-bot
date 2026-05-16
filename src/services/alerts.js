import { EmbedBuilder } from 'discord.js';
import { client } from '../client.js';
import { fetchOHLCV, fetchTicker } from './exchange.js';
import {
  calcRSI,
  rsiSignal,
  emaCrossSignal,
  macdSignal,
  bollingerSignal,
  elliottWaveSignal,
  calcConsensus,
  calcATR,
  calcSLTP,
} from './indicators.js';
import { loadWatchList, saveWatchList, loadThreshold, saveThreshold } from './storage.js';

// ─── Watchlist (loaded from disk, fallback to env) ────────────────────────────
export const watchList = loadWatchList();
export { saveWatchList };

// ─── Alert threshold ──────────────────────────────────────────────────────────
let alertThreshold = loadThreshold();

export function getAlertThreshold() { return alertThreshold; }
export function setAlertThreshold(value) {
  alertThreshold = value;
  saveThreshold(value);
}

// ─── Deduplication: จำ consensus ล่าสุดของแต่ละ symbol ─────────────────────
const lastConsensus = new Map();

/**
 * วิเคราะห์ symbol แล้วคืน object ผลลัพธ์
 */
export async function analyzeSymbol(symbol, timeframe = '1h') {
  const [candles, ticker] = await Promise.all([
    fetchOHLCV(symbol, timeframe, 100),
    fetchTicker(symbol),
  ]);

  const closes = candles.map((c) => c.close);

  const rsiSig     = rsiSignal(calcRSI(closes));
  const emaSig     = emaCrossSignal(closes, 9, 21);
  const macdSig    = macdSignal(closes);
  const elliottSig = elliottWaveSignal(candles);
  const bbSig      = bollingerSignal(closes);

  const { consensus, score } = calcConsensus([
    rsiSig.signal, emaSig.signal, macdSig.signal, elliottSig.signal,
  ]);

  const atr   = calcATR(candles);
  const sltp  = calcSLTP(ticker.price, atr, consensus, elliottSig.detail?.wave3TargetRaw ?? null);

  return { symbol, timeframe, ticker, rsiSig, emaSig, macdSig, elliottSig, bbSig, consensus, score, sltp };
}

/**
 * สร้าง Discord Embed สำหรับแสดงผลการวิเคราะห์
 */
export function buildSignalEmbed(result) {
  const { symbol, timeframe, ticker, rsiSig, emaSig, macdSig, elliottSig, consensus, score, sltp } = result;

  const changeSign = ticker.change24h >= 0 ? '+' : '';
  const price      = ticker.price.toLocaleString('en-US', { maximumFractionDigits: 4 });
  const change     = `${changeSign}${ticker.change24h?.toFixed(2)}%`;

  const color = consensus.includes('BUY')  ? 0x00c87a :
                consensus.includes('SELL') ? 0xff4444 : 0x888888;

  // สรุป indicators ในบรรทัดเดียว
  const indicatorLine = [
    `RSI ${rsiSig.signal}`,
    `EMA ${emaSig.signal.replace('HOLD_', '')}`,
    `MACD ${macdSig.signal.replace('HOLD_', '')}`,
    `Elliott ${elliottSig.signal}`,
  ].join('  ·  ');

  const embed = new EmbedBuilder()
    .setTitle(`${symbol}  —  $${price}  (${change} 24h)`)
    .setColor(color)
    .addFields({
      name: `Signal  ${score}/4`,
      value: `**${consensus}**\n\`${indicatorLine}\``,
      inline: false,
    });

  if (sltp) {
    const sign = (pct) => Number(pct) > 0 ? `+${pct}%` : `${pct}%`;
    embed.addFields({
      name: `${sltp.direction === 'BUY' ? 'Long' : 'Short'}  ·  R:R = 1:${sltp.rr}`,
      value: [
        `Entry   $${sltp.entry.market}  ·  Limit $${sltp.entry.limit}`,
        `SL      $${sltp.sl.price}  (${sign(sltp.sl.pct)})`,
        `TP1     $${sltp.tp1.price}  (${sign(sltp.tp1.pct)})`,
        `TP2     $${sltp.tp2.price}  (${sign(sltp.tp2.pct)})`,
        `TP3     $${sltp.tp3.price}  (${sign(sltp.tp3.pct)})`,
      ].join('\n'),
      inline: false,
    });
  }

  embed
    .setFooter({ text: `${timeframe ?? '1h'}  ·  ${new Date().toLocaleString('th-TH')}` })
    .setTimestamp();

  return embed;
}

/**
 * ส่ง alert เฉพาะเมื่อสัญญาณถึง threshold และ consensus เปลี่ยนจากรอบที่แล้ว
 */
export async function sendAlerts(timeframe = '1h') {
  const channelId = process.env.ALERT_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  for (const symbol of watchList) {
    try {
      const result = await analyzeSymbol(symbol, timeframe);

      if (result.score < alertThreshold) continue;

      const prev = lastConsensus.get(symbol);
      if (prev === result.consensus) continue;   // dedup: ไม่ส่งซ้ำ

      lastConsensus.set(symbol, result.consensus);
      const embed = buildSignalEmbed(result);
      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(`[alerts] ${symbol}:`, err.message);
    }
  }
}

