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
import { loadWatchList, loadThreshold, loadGuildConfig, saveGuildConfig, getAllGuildConfigs } from './storage.js';

// ─── Per-guild config helpers ──────────────────────────────────────────────────

function defaultGuildConfig(guildId) {
  // Auto-migrate env/file config for the original guild
  const isMigratingGuild = guildId === process.env.GUILD_ID;
  return {
    guildId,
    alertChannelId: isMigratingGuild ? (process.env.ALERT_CHANNEL_ID || null) : null,
    watchlist: isMigratingGuild ? [...loadWatchList()] : ['BTC/USDT', 'ETH/USDT'],
    threshold: isMigratingGuild ? loadThreshold() : 2,
  };
}

export function getGuildConfig(guildId) {
  return loadGuildConfig(guildId) ?? defaultGuildConfig(guildId);
}

export function getGuildWatchList(guildId) {
  return new Set(getGuildConfig(guildId).watchlist);
}

export function saveGuildWatchList(guildId, set) {
  const config = getGuildConfig(guildId);
  config.watchlist = [...set];
  saveGuildConfig(guildId, config);
}

export function getGuildThreshold(guildId) {
  return getGuildConfig(guildId).threshold ?? 2;
}

export function setGuildThreshold(guildId, value) {
  const config = getGuildConfig(guildId);
  config.threshold = value;
  saveGuildConfig(guildId, config);
}

export function setGuildAlertChannel(guildId, channelId) {
  const config = getGuildConfig(guildId);
  config.alertChannelId = channelId;
  saveGuildConfig(guildId, config);
}

// ─── Deduplication per guild ───────────────────────────────────────────────────
const lastConsensusPerGuild = new Map(); // Map<guildId, Map<symbol, consensus>>

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
 * ส่ง alert ไปยังทุก guild ที่มีการตั้งค่า alertChannelId ไว้
 */
export async function sendAlerts(timeframe = '1h') {
  let guildConfigs = getAllGuildConfigs();

  // Backward compat: ถ้ายังไม่มี guild configs ให้ใช้ env vars
  if (guildConfigs.length === 0) {
    const channelId = process.env.ALERT_CHANNEL_ID;
    const guildId   = process.env.GUILD_ID;
    if (!channelId || !guildId) return;
    guildConfigs = [defaultGuildConfig(guildId)];
    guildConfigs[0].alertChannelId = channelId;
  }

  for (const config of guildConfigs) {
    if (!config.alertChannelId || !config.watchlist?.length) continue;

    const channel = await client.channels.fetch(config.alertChannelId).catch(() => null);
    if (!channel) continue;

    if (!lastConsensusPerGuild.has(config.guildId)) {
      lastConsensusPerGuild.set(config.guildId, new Map());
    }
    const lastConsensus = lastConsensusPerGuild.get(config.guildId);
    const threshold = config.threshold ?? 2;

    for (const symbol of config.watchlist) {
      try {
        const result = await analyzeSymbol(symbol, timeframe);

        if (result.score < threshold) continue;

        const prev = lastConsensus.get(symbol);
        if (prev === result.consensus) continue; // dedup

        lastConsensus.set(symbol, result.consensus);
        const embed = buildSignalEmbed(result);
        await channel.send({ embeds: [embed] });
      } catch (err) {
        console.error(`[alerts] ${config.guildId}/${symbol}:`, err.message);
      }
    }
  }
}

