// ─── RSI ─────────────────────────────────────────────────────────────────────

/**
 * คำนวณ RSI
 * @param {number[]} closes ราคาปิด
 * @param {number} period ค่าเริ่มต้น 14
 * @returns {number} RSI ล่าสุด
 */
export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
}

/**
 * แปลค่า RSI เป็นสัญญาณ
 */
export function rsiSignal(rsi) {
  if (rsi === null) return { signal: 'NEUTRAL', label: '⚪ ไม่มีข้อมูลพอ' };
  if (rsi <= 30) return { signal: 'BUY', label: `🟢 Oversold (${rsi})` };
  if (rsi >= 70) return { signal: 'SELL', label: `🔴 Overbought (${rsi})` };
  return { signal: 'NEUTRAL', label: `⚪ Neutral (${rsi})` };
}

// ─── EMA ─────────────────────────────────────────────────────────────────────

/**
 * คำนวณ EMA array
 * @param {number[]} closes
 * @param {number} period
 * @returns {number[]}
 */
export function calcEMAArray(closes, period) {
  const k = 2 / (period + 1);
  const ema = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    ema.push(closes[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

/**
 * ตรวจ EMA Cross สัญญาณ
 * @param {number[]} closes
 * @param {number} fastPeriod เช่น 9
 * @param {number} slowPeriod เช่น 21
 */
export function emaCrossSignal(closes, fastPeriod = 9, slowPeriod = 21) {
  if (closes.length < slowPeriod + 2) return { signal: 'NEUTRAL', label: '⚪ ข้อมูลไม่พอ' };

  const fast = calcEMAArray(closes, fastPeriod);
  const slow = calcEMAArray(closes, slowPeriod);

  const len = fast.length;
  const prevFast = fast[len - 2];
  const prevSlow = slow[len - 2];
  const currFast = fast[len - 1];
  const currSlow = slow[len - 1];

  const fastVal = currFast.toFixed(2);
  const slowVal = currSlow.toFixed(2);

  if (prevFast <= prevSlow && currFast > currSlow) {
    return { signal: 'BUY', label: `🟢 Golden Cross EMA${fastPeriod}=${fastVal} / EMA${slowPeriod}=${slowVal}` };
  }
  if (prevFast >= prevSlow && currFast < currSlow) {
    return { signal: 'SELL', label: `🔴 Death Cross EMA${fastPeriod}=${fastVal} / EMA${slowPeriod}=${slowVal}` };
  }

  const trend = currFast > currSlow ? 'Bullish' : 'Bearish';
  return {
    signal: currFast > currSlow ? 'HOLD_BUY' : 'HOLD_SELL',
    label: `⚪ ${trend} EMA${fastPeriod}=${fastVal} / EMA${slowPeriod}=${slowVal}`,
  };
}

// ─── Elliott Wave ─────────────────────────────────────────────────────────────

const FIB_RATIOS = {
  wave2RetraceLow: 0.382,
  wave2RetraceHigh: 0.618,
  wave3TargetMin: 1.618,
  wave3TargetIdeal: 2.618,
  wave4RetraceLow: 0.236,
  wave4RetraceHigh: 0.382,
};

/**
 * หา Pivot High / Pivot Low (ZigZag อย่างง่าย)
 * @param {object[]} candles OHLCV
 * @param {number} lookback จำนวน candle รอบข้างที่ต้องชนะ
 * @returns {{ type: 'high'|'low', price: number, index: number }[]}
 */
function detectPivots(candles, lookback = 3) {
  const pivots = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const curr = candles[i];
    const neighbors = candles.slice(i - lookback, i + lookback + 1);

    const isHigh = neighbors.every((c, idx) => idx === lookback || c.high <= curr.high);
    const isLow = neighbors.every((c, idx) => idx === lookback || c.low >= curr.low);

    if (isHigh) pivots.push({ type: 'high', price: curr.high, index: i });
    else if (isLow) pivots.push({ type: 'low', price: curr.low, index: i });
  }
  return pivots;
}

/**
 * คำนวณ Fibonacci levels จาก wave 1
 * @param {number} wave1Start
 * @param {number} wave1End
 * @param {'bullish'|'bearish'} direction
 */
function calcFibLevels(wave1Start, wave1End, direction) {
  const wave1Size = Math.abs(wave1End - wave1Start);
  if (direction === 'bullish') {
    return {
      wave2Low: wave1End - wave1Size * FIB_RATIOS.wave2RetraceHigh,
      wave2High: wave1End - wave1Size * FIB_RATIOS.wave2RetraceLow,
      wave3Target: wave1End + wave1Size * FIB_RATIOS.wave3TargetMin,
      wave3Ideal: wave1End + wave1Size * FIB_RATIOS.wave3TargetIdeal,
    };
  }
  return {
    wave2Low: wave1End + wave1Size * FIB_RATIOS.wave2RetraceLow,
    wave2High: wave1End + wave1Size * FIB_RATIOS.wave2RetraceHigh,
    wave3Target: wave1End - wave1Size * FIB_RATIOS.wave3TargetMin,
    wave3Ideal: wave1End - wave1Size * FIB_RATIOS.wave3TargetIdeal,
  };
}

/**
 * วิเคราะห์ Elliott Wave อย่างง่าย
 * @param {object[]} candles OHLCV
 * @returns {{ signal: string, label: string, detail: object|null }}
 */
export function elliottWaveSignal(candles) {
  if (candles.length < 30) {
    return { signal: 'NEUTRAL', label: '⚪ ข้อมูลไม่พอสำหรับ Elliott Wave', detail: null };
  }

  const pivots = detectPivots(candles, 3);

  // ต้องการ pivot อย่างน้อย 4 จุดเพื่อระบุ wave 1-2
  if (pivots.length < 4) {
    return { signal: 'NEUTRAL', label: '⚪ Elliott: pivot ไม่เพียงพอ', detail: null };
  }

  // ใช้ pivot ล่าสุด 4 จุด
  const recent = pivots.slice(-4);
  const [p0, p1, p2, p3] = recent;

  // ตรวจ Bullish impulse: low → high → pullback → resume up
  const isBullish =
    p0.type === 'low' &&
    p1.type === 'high' &&
    p2.type === 'low' &&
    p3.type === 'high' &&
    p1.price > p0.price &&
    p2.price > p0.price &&   // wave 2 ไม่ต่ำกว่าจุดเริ่ม
    p3.price > p1.price;     // wave 3 สูงกว่า wave 1

  // ตรวจ Bearish impulse: high → low → pullback → resume down
  const isBearish =
    p0.type === 'high' &&
    p1.type === 'low' &&
    p2.type === 'high' &&
    p3.type === 'low' &&
    p1.price < p0.price &&
    p2.price < p0.price &&
    p3.price < p1.price;

  const currentPrice = candles[candles.length - 1].close;
  const fmt = (n) => n?.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '?';

  if (isBullish) {
    const fib = calcFibLevels(p0.price, p1.price, 'bullish');
    const wave2Valid = p2.price >= fib.wave2Low && p2.price <= fib.wave2High;
    const inWave3 = currentPrice > p1.price;

    const wavePos = inWave3 ? 'Wave 3 (Bullish Impulse)' : 'Wave 2 Correction';
    const signal = inWave3 ? 'BUY' : 'NEUTRAL';
    const emoji = inWave3 ? '🟢' : '🟡';

    return {
      signal,
      label: `${emoji} Elliott: ${wavePos}`,
      detail: {
        direction: 'Bullish',
        wave1Start: fmt(p0.price),
        wave1End: fmt(p1.price),
        wave2Low: fmt(p2.price),
        wave3Target: fmt(fib.wave3Target),
        wave3Ideal: fmt(fib.wave3Ideal),
        wave2Valid,
        currentPrice: fmt(currentPrice),
      },
    };
  }

  if (isBearish) {
    const fib = calcFibLevels(p0.price, p1.price, 'bearish');
    const inWave3 = currentPrice < p1.price;
    const wavePos = inWave3 ? 'Wave 3 (Bearish Impulse)' : 'Wave 2 Correction';
    const signal = inWave3 ? 'SELL' : 'NEUTRAL';
    const emoji = inWave3 ? '🔴' : '🟡';

    return {
      signal,
      label: `${emoji} Elliott: ${wavePos}`,
      detail: {
        direction: 'Bearish',
        wave1Start: fmt(p0.price),
        wave1End: fmt(p1.price),
        wave2High: fmt(p2.price),
        wave3Target: fmt(fib.wave3Target),
        wave3Ideal: fmt(fib.wave3Ideal),
        currentPrice: fmt(currentPrice),
      },
    };
  }

  return { signal: 'NEUTRAL', label: '⚪ Elliott: ไม่พบรูปแบบคลื่นชัดเจน', detail: null };
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

/**
 * คำนวณ MACD line, Signal line, Histogram
 * @param {number[]} closes
 * @param {number} fast  default 12
 * @param {number} slow  default 26
 * @param {number} signal default 9
 */
export function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return null;
  const fastEMA = calcEMAArray(closes, fast);
  const slowEMA = calcEMAArray(closes, slow);
  // align to slow length
  const macdLine = fastEMA.slice(slow - fast).map((v, i) => v - slowEMA[i]);
  const signalLine = calcEMAArray(macdLine, signal);
  return { macdLine, signalLine };
}

/**
 * แปลผล MACD เป็นสัญญาณ
 */
export function macdSignal(closes) {
  const result = calcMACD(closes);
  if (!result) return { signal: 'NEUTRAL', label: '⚪ ข้อมูลไม่พอ' };

  const { macdLine, signalLine } = result;
  const len = macdLine.length;
  const prevMACD = macdLine[len - 2];
  const prevSig = signalLine[len - 2];
  const currMACD = macdLine[len - 1];
  const currSig = signalLine[len - 1];
  const hist = (currMACD - currSig).toFixed(4);

  if (prevMACD <= prevSig && currMACD > currSig) {
    return { signal: 'BUY', label: `🟢 MACD Cross Up (hist: ${hist})` };
  }
  if (prevMACD >= prevSig && currMACD < currSig) {
    return { signal: 'SELL', label: `🔴 MACD Cross Down (hist: ${hist})` };
  }

  const trend = currMACD > currSig ? 'Bullish' : 'Bearish';
  return {
    signal: currMACD > currSig ? 'HOLD_BUY' : 'HOLD_SELL',
    label: `⚪ MACD ${trend} (hist: ${hist})`,
  };
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

/**
 * คำนวณ Bollinger Bands (SMA20 ± 2σ)
 * @param {number[]} closes
 * @param {number} period default 20
 * @param {number} mult   default 2
 */
export function calcBollingerBands(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, v) => sum + (v - sma) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    upper: parseFloat((sma + mult * stdDev).toFixed(4)),
    middle: parseFloat(sma.toFixed(4)),
    lower: parseFloat((sma - mult * stdDev).toFixed(4)),
  };
}

/**
 * แปลผล Bollinger Bands เป็นสัญญาณ (display-only ไม่รวมใน consensus)
 */
export function bollingerSignal(closes) {
  const bb = calcBollingerBands(closes);
  if (!bb) return { label: '⚪ ข้อมูลไม่พอ', bb: null };

  const price = closes[closes.length - 1];
  const { upper, middle, lower } = bb;
  const width = ((upper - lower) / middle * 100).toFixed(1);

  if (price <= lower) return { label: `🟢 ใกล้ Lower $${lower} (width: ${width}%)`, bb };
  if (price >= upper) return { label: `🔴 ใกล้ Upper $${upper} (width: ${width}%)`, bb };
  return { label: `⚪ ภายใน Band $${lower}–$${upper} (width: ${width}%)`, bb };
}

// ─── สรุปสัญญาณรวม ────────────────────────────────────────────────────────────

/**
 * รวม signal 3 ตัว → สรุป consensus
 * @param {string[]} signals ['BUY','BUY','SELL']
 * @returns {{ consensus: string, score: number }}
 */
export function calcConsensus(signals) {
  const buy = signals.filter((s) => s === 'BUY' || s === 'HOLD_BUY').length;
  const sell = signals.filter((s) => s === 'SELL' || s === 'HOLD_SELL').length;
  const total = signals.length;

  if (buy === total) return { consensus: '⚡ Strong BUY', score: buy };
  if (sell === total) return { consensus: '⚡ Strong SELL', score: sell };
  if (buy > sell) return { consensus: '🟢 BUY', score: buy };
  if (sell > buy) return { consensus: '🔴 SELL', score: sell };
  return { consensus: '⚪ NEUTRAL', score: 0 };
}
