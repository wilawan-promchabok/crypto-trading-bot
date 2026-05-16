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
  const { symbol, timeframe, ticker, rsiSig, emaSig, macdSig, elliottSig, bbSig, consensus, score, sltp } = result;
  const total = 4;

  const changeEmoji = ticker.change24h >= 0 ? '📈' : '📉';
  const changeSign  = ticker.change24h >= 0 ? '+' : '';
  const price = ticker.price.toLocaleString('en-US', { maximumFractionDigits: 4 });

  const embed = new EmbedBuilder()
    .setTitle(`${changeEmoji} ${symbol}`)
    .setColor(
      consensus.includes('BUY') ? 0x00c87a :
      consensus.includes('SELL') ? 0xff4444 : 0x888888
    )
    .addFields(
      {
        name: '💰 ราคาปัจจุบัน',
        value: `$${price}  (${changeSign}${ticker.change24h?.toFixed(2)}% 24h)`,
        inline: false,
      },
      { name: '📊 RSI (14)',    value: rsiSig.label,     inline: true },
      { name: '📉 EMA Cross',   value: emaSig.label,     inline: true },
      { name: '📈 MACD',        value: macdSig.label,    inline: true },
      { name: '🌊 Elliott Wave', value: elliottSig.label, inline: true },
      { name: '📐 Bollinger',   value: bbSig.label,      inline: false },
    )
    .addFields({
      name: `🎯 สรุป (${score}/${total})`,
      value: `**${consensus}**`,
      inline: false,
    });

  // SL/TP
  if (sltp) {
    const dir  = sltp.direction === 'BUY' ? '🟢 BUY' : '🔴 SELL';
    const sign = (pct) => pct > 0 ? `+${pct}%` : `${pct}%`;
    embed.addFields({
      name: `🛡️ SL / TP  [${dir}]  R:R = 1:${sltp.rr}`,
      value: [
        `📍 **Entry**  $${sltp.entry.market}  _(market)_   |   $${sltp.entry.limit}  _(limit zone)_`,
        `🛑 **SL**     $${sltp.sl.price}  \`${sign(sltp.sl.pct)}\``,
        `🎯 **TP1**    $${sltp.tp1.price}  \`${sign(sltp.tp1.pct)}\``,
        `🎯 **TP2**    $${sltp.tp2.price}  \`${sign(sltp.tp2.pct)}\``,
        `🎯 **TP3**    $${sltp.tp3.price}  \`${sign(sltp.tp3.pct)}\`${elliottSig.detail ? '  _(Elliott target)_' : ''}`,
      ].join('\n'),
      inline: false,
    });
  }

  // Elliott Wave detail
  if (elliottSig.detail) {
    const d = elliottSig.detail;
    const lines = [
      `Direction: ${d.direction}`,
      `Wave 1: ${d.wave1Start} → ${d.wave1End}`,
      d.wave3Target ? `Wave 3 Target: $${d.wave3Target}` : '',
      d.wave3Ideal  ? `Wave 3 Ideal: $${d.wave3Ideal}`   : '',
    ].filter(Boolean).join('\n');

    embed.addFields({ name: '🌊 Elliott Detail', value: `\`\`\`${lines}\`\`\``, inline: false });
  }

  embed
    .setFooter({ text: `Timeframe: ${timeframe ?? '1h'} • ${new Date().toLocaleString('th-TH')}` })
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

