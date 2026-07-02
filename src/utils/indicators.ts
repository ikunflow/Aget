import type { DailyBar, IndicatorData, MACDResult, KDJResult, BollingerResult } from './types';

// 均线计算
function calcMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[i - j];
      }
      result.push(Math.round((sum / period) * 100) / 100);
    }
  }
  return result;
}

// EMA计算
function calcEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      ema += data[i] / period;
    } else if (i === period - 1) {
      ema += data[i] / period;
      result.push(Math.round(ema * 100) / 100);
    } else {
      ema = data[i] * k + ema * (1 - k);
      result.push(Math.round(ema * 100) / 100);
    }
  }
  return result;
}

// MACD计算 (12,26,9)
function calcMACD(closes: number[]): MACDResult {
  const dif = calcEMA(closes, 12).map((v, i) => {
    const ema26 = calcEMA(closes, 26)[i];
    if (isNaN(v) || isNaN(ema26)) return NaN;
    return Math.round((v - ema26) * 100) / 100;
  });

  const validDif = dif.filter(v => !isNaN(v));
  const deaFull = calcEMA(validDif, 9);
  const dea: number[] = [];
  let validIdx = 0;
  for (let i = 0; i < dif.length; i++) {
    if (isNaN(dif[i])) {
      dea.push(NaN);
    } else {
      dea.push(deaFull[validIdx] ?? NaN);
      validIdx++;
    }
  }

  const macd = dif.map((v, i) => {
    if (isNaN(v) || isNaN(dea[i])) return NaN;
    return Math.round((v - dea[i]) * 2 * 100) / 100;
  });

  return { dif, dea, macd };
}

// KDJ计算 (9,3,3)
function calcKDJ(bars: DailyBar[]): KDJResult {
  const period = 9;
  const kArr: number[] = [];
  const dArr: number[] = [];
  const jArr: number[] = [];
  let k = 50, d = 50;

  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      kArr.push(NaN);
      dArr.push(NaN);
      jArr.push(NaN);
      continue;
    }
    let highest = -Infinity, lowest = Infinity;
    for (let j = 0; j < period; j++) {
      const idx = i - j;
      if (bars[idx].high > highest) highest = bars[idx].high;
      if (bars[idx].low < lowest) lowest = bars[idx].low;
    }
    const rsv = highest === lowest ? 50 : ((bars[i].close - lowest) / (highest - lowest)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    const j = 3 * k - 2 * d;
    kArr.push(Math.round(k * 100) / 100);
    dArr.push(Math.round(d * 100) / 100);
    jArr.push(Math.round(j * 100) / 100);
  }

  return { k: kArr, d: dArr, j: jArr };
}

// 布林带计算 (20,2)
function calcBoll(closes: number[]): BollingerResult {
  const period = 20;
  const mid: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      mid.push(NaN);
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += closes[i - j];
    const mean = sum / period;
    let sqSum = 0;
    for (let j = 0; j < period; j++) sqSum += (closes[i - j] - mean) ** 2;
    const std = Math.sqrt(sqSum / period);
    mid.push(Math.round(mean * 100) / 100);
    upper.push(Math.round((mean + 2 * std) * 100) / 100);
    lower.push(Math.round((mean - 2 * std) * 100) / 100);
  }

  return { mid, upper, lower };
}

// RSI计算 (14)
function calcRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(NaN);
      continue;
    }
    let gainSum = 0, lossSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) gainSum += change;
      else lossSum -= change;
    }
    const avgGain = gainSum / period;
    const avgLoss = lossSum / period;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    result.push(Math.round(rsi * 100) / 100);
  }
  return result;
}

// 计算全部指标
export function calcAllIndicators(bars: DailyBar[]): IndicatorData {
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);

  return {
    ma5: calcMA(closes, 5),
    ma10: calcMA(closes, 10),
    ma20: calcMA(closes, 20),
    ma60: calcMA(closes, 60),
    macd: calcMACD(closes),
    kdj: calcKDJ(bars),
    boll: calcBoll(closes),
    rsi: calcRSI(closes),
    volMa5: calcMA(volumes, 5),
    volMa10: calcMA(volumes, 10),
  };
}
