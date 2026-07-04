import type { DailyBar } from './types';

// 因子评分计算(纯函数,可在历史数据上回放)
export interface FactorScores {
  technical: number;   // 0-100
  momentum: number;    // 0-100
  trend: number;       // 0-100
  pattern: number;     // 0-100
}

// 计算 RSI
function calcRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function calcEMA(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes: number[]): { macd: number; signal: number; hist: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, hist: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  return { macd, signal: macd * 0.8, hist: macd * 0.2 };
}

function calcBollingerPosition(closes: number[], period: number = 20): number {
  if (closes.length < period) return 0.5;
  const recent = closes.slice(-period);
  const ma = recent.reduce((s, v) => s + v, 0) / period;
  const std = Math.sqrt(recent.reduce((s, v) => s + (v - ma) ** 2, 0) / period);
  const upper = ma + 2 * std;
  const lower = ma - 2 * std;
  const current = closes[closes.length - 1];
  if (upper === lower) return 0.5;
  return (current - lower) / (upper - lower);
}

// 计算单个时点的因子得分(纯函数,便于回测)
export function calcFactors(bars: DailyBar[]): FactorScores | null {
  const closes = bars.map(b => b.close);
  if (closes.length < 30) return null;

  // === 技术指标 ===
  const rsi = calcRSI(closes, 14);
  const macd = calcMACD(closes);
  const bollPos = calcBollingerPosition(closes, 20);

  let technical = 50;
  if (rsi < 30) technical += 20;
  else if (rsi < 40) technical += 10;
  else if (rsi > 70) technical -= 20;
  else if (rsi > 60) technical -= 10;
  if (macd.hist > 0 && macd.macd > macd.signal) technical += 10;
  else if (macd.hist < 0 && macd.macd < macd.signal) technical -= 10;
  if (bollPos < 0.2) technical += 10;
  else if (bollPos > 0.8) technical -= 10;
  technical = Math.max(0, Math.min(100, technical));

  // === 短期动量 ===
  const last5 = closes.slice(-5);
  const momentum5 = (last5[last5.length - 1] - last5[0]) / last5[0];
  let momentum = 50;
  if (momentum5 > 0.03) momentum += 25;
  else if (momentum5 > 0.01) momentum += 15;
  else if (momentum5 > 0) momentum += 5;
  else if (momentum5 > -0.01) momentum -= 5;
  else if (momentum5 > -0.03) momentum -= 15;
  else momentum -= 25;

  // === 趋势强度 ===
  const ma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
  const maDiff = (closes[closes.length - 1] - ma20) / ma20;
  let trend = 50;
  if (maDiff > 0.05) trend += 25;
  else if (maDiff > 0.02) trend += 15;
  else if (maDiff > 0) trend += 5;
  else if (maDiff > -0.02) trend -= 5;
  else if (maDiff > -0.05) trend -= 15;
  else trend -= 25;

  // === 历史模式(基于更严格的分桶匹配)===
  let pattern = 50;
  if (closes.length >= 250) {
    const rsiBucket = Math.floor(rsi / 10);
    const macdSign = macd.hist > 0 ? 1 : -1;
    const trendBucket = Math.floor((maDiff + 0.06) / 0.024); // -6%~6% 分5档
    let upCount = 0, downCount = 0, total = 0;
    for (let i = 250; i < closes.length - 1; i++) {
      const past = closes.slice(0, i + 1);
      if (past.length < 30) continue;
      const pastRsi = calcRSI(past, 14);
      const pastMacd = calcMACD(past);
      const pastMa20 = past.slice(-20).reduce((s, v) => s + v, 0) / 20;
      const pastMaDiff = (past[past.length - 1] - pastMa20) / pastMa20;
      const pastRsiBucket = Math.floor(pastRsi / 10);
      const pastMacdSign = pastMacd.hist > 0 ? 1 : -1;
      const pastTrendBucket = Math.floor((pastMaDiff + 0.06) / 0.024);

      if (pastRsiBucket === rsiBucket && pastMacdSign === macdSign && pastTrendBucket === trendBucket) {
        const nextReturn = (closes[i + 1] - closes[i]) / closes[i];
        if (nextReturn > 0) upCount++;
        else if (nextReturn < 0) downCount++;
        total++;
      }
    }
    if (total >= 5) {
      pattern = Math.round((upCount / total) * 100);
    }
  }

  return { technical, momentum, trend, pattern };
}

// 权重组合
export interface WeightCombo {
  technical: number;
  momentum: number;
  trend: number;
  pattern: number;
}

export const DEFAULT_WEIGHTS: WeightCombo = {
  technical: 0.35, momentum: 0.25, trend: 0.20, pattern: 0.20,
};

// 计算综合得分
export function applyWeights(f: FactorScores, w: WeightCombo): number {
  return f.technical * w.technical
       + f.momentum * w.momentum
       + f.trend * w.trend
       + f.pattern * w.pattern;
}

// 网格搜索最优权重(在历史数据上最大化方向命中率)
// 步长5%,约束总和=1.0
export function optimizeWeights(
  bars: DailyBar[],
  lookforward: number = 5,  // 预测未来5日方向
  step: number = 0.05
): { best: WeightCombo; accuracy: number; sampleSize: number } {
  const n = bars.length;
  if (n < 300) {
    return { best: DEFAULT_WEIGHTS, accuracy: 0, sampleSize: 0 };
  }

  // 准备历史快照和实际方向
  interface Sample { factors: FactorScores; actualDir: 1 | -1 | 0; }
  const samples: Sample[] = [];

  for (let i = 200; i < n - lookforward; i++) {
    const window = bars.slice(0, i + 1);
    const f = calcFactors(window);
    if (!f) continue;
    const futureClose = bars[i + lookforward].close;
    const futureReturn = (futureClose - bars[i].close) / bars[i].close;
    const dir: 1 | -1 | 0 = futureReturn > 0.005 ? 1 : futureReturn < -0.005 ? -1 : 0;
    samples.push({ factors: f, actualDir: dir });
  }

  if (samples.length < 30) {
    return { best: DEFAULT_WEIGHTS, accuracy: 0, sampleSize: samples.length };
  }

  let best: WeightCombo = DEFAULT_WEIGHTS;
  let bestAcc = 0;
  const validDirections = samples.filter(s => s.actualDir !== 0);

  // 网格搜索:technical ∈ [0.1, 0.6], momentum ∈ [0.1, 0.5], trend ∈ [0.1, 0.4], pattern ∈ [0.1, 0.4]
  for (let t = 0.10; t <= 0.60 + 1e-9; t += step) {
    for (let m = 0.10; m <= 0.50 + 1e-9; m += step) {
      for (let tr = 0.10; tr <= 0.40 + 1e-9; tr += step) {
        for (let p = 0.10; p <= 0.40 + 1e-9; p += step) {
          const sum = t + m + tr + p;
          if (Math.abs(sum - 1.0) > 0.01) continue;
          const w: WeightCombo = { technical: t, momentum: m, trend: tr, pattern: p };
          // 计算该权重下的方向命中率
          let correct = 0;
          for (const s of validDirections) {
            const score = applyWeights(s.factors, w);
            const predDir = score > 50 ? 1 : -1;
            if (predDir === s.actualDir) correct++;
          }
          const acc = correct / validDirections.length;
          if (acc > bestAcc) {
            bestAcc = acc;
            best = w;
          }
        }
      }
    }
  }

  return { best, accuracy: bestAcc, sampleSize: validDirections.length };
}

// 缓存优化结果到 localStorage
const CACHE_KEY = 'weight_optimizer_cache';

interface CacheEntry {
  code: string;
  weights: WeightCombo;
  accuracy: number;
  sampleSize: number;
  updatedAt: number;
}

function loadCache(): Record<string, CacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export function getCachedWeights(code: string): CacheEntry | null {
  const cache = loadCache();
  const entry = cache[code];
  if (!entry) return null;
  // 7天过期
  if (Date.now() - entry.updatedAt > 7 * 24 * 3600 * 1000) return null;
  return entry;
}

export function setCachedWeights(code: string, entry: Omit<CacheEntry, 'code' | 'updatedAt'>) {
  const cache = loadCache();
  cache[code] = { ...entry, code, updatedAt: Date.now() };
  saveCache(cache);
}
