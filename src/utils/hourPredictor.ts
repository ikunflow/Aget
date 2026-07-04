import type { DailyBar, IndicatorData } from './types';

// 基于输入的确定性伪随机数生成器(保证相同输入→相同输出)
// 使用 mulberry32 算法,种子由 code + 预测日期 + 当前价 hash 得到
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeededRand(code: string, dateStr: string, price: number): () => number {
  const seed = hashString(`${code}|${dateStr}|${price.toFixed(4)}`);
  return mulberry32(seed);
}

// 预测快照:用于让同一天同代码的预测保持一致
function getPredictionKey(dateStr: string): string {
  // 用到日(交易日期)做快照键,保证同一天内结果一致
  return dateStr.slice(0, 10);
}

// 小时级预测结果
export interface HourPrediction {
  // 12个5分钟点(覆盖1小时)
  predictedBars: { time: string; open: number; high: number; low: number; close: number; volume: number }[];
  // 综合预测评分 0-100
  score: number;
  // 趋势方向: 'up' | 'down' | 'flat'
  direction: 'up' | 'down' | 'flat';
  // 1小时后的预测价格
  predictedClose: number;
  // 预计涨跌幅 (%)
  expectedChange: number;
  // 预测置信度 0-1
  confidence: number;
  // 各维度评分
  factors: {
    technical: number;       // 技术指标得分
    momentum: number;        // 短期动量得分
    volatility: number;      // 波动性参考
    pattern: number;         // 历史模式得分
    trend: number;           // 趋势强度
  };
  // 预测方法说明
  method: string;
}

// 生成未来12个5分钟点时间标签
function generateTimeSlots(startTime: Date, count: number): string[] {
  const slots: string[] = [];
  const d = new Date(startTime);
  for (let i = 0; i < count; i++) {
    d.setMinutes(d.getMinutes() + 5);
    slots.push(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
  }
  return slots;
}

// 计算 RSI 指标(简化版)
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

// 计算简单MACD
function calcMACD(closes: number[]): { macd: number; signal: number; hist: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, hist: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  return { macd, signal: macd * 0.8, hist: macd * 0.2 };
}

function calcEMA(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

// 计算布林带位置
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

// 1小时预测主函数
export function predictHour(
  code: string,
  bars: DailyBar[],
  indicators: IndicatorData | null,
  marketHeat: number = 50
): HourPrediction {
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  const currentPrice = closes[closes.length - 1];
  const lastDate = bars[bars.length - 1].date;
  // 确定性种子:相同代码+日期+价格,预测结果一致
  const rand = makeSeededRand(code, getPredictionKey(lastDate), currentPrice);

  if (closes.length < 20) {
    return defaultPrediction(currentPrice, '数据不足');
  }

  // === 1. 技术指标评分 ===
  const rsi = calcRSI(closes, 14);
  const macd = calcMACD(closes);
  const bollPos = calcBollingerPosition(closes, 20);

  let technicalScore = 50;
  // RSI: 30-70中性, <30超卖看涨, >70超买卖出
  if (rsi < 30) technicalScore += 20;
  else if (rsi < 40) technicalScore += 10;
  else if (rsi > 70) technicalScore -= 20;
  else if (rsi > 60) technicalScore -= 10;
  // MACD: 金叉看涨
  if (macd.hist > 0 && macd.macd > macd.signal) technicalScore += 10;
  else if (macd.hist < 0 && macd.macd < macd.signal) technicalScore -= 10;
  // 布林带: 下轨附近看涨
  if (bollPos < 0.2) technicalScore += 10;
  else if (bollPos > 0.8) technicalScore -= 10;
  technicalScore = Math.max(0, Math.min(100, technicalScore));

  // === 2. 短期动量(近5日) ===
  const last5 = closes.slice(-5);
  const last10 = closes.slice(-10);
  const momentum5 = (last5[last5.length - 1] - last5[0]) / last5[0];
  const momentum10 = last10.length >= 10
    ? (last10[last10.length - 1] - last10[0]) / last10[0]
    : momentum5;

  let momentumScore = 50;
  if (momentum5 > 0.03) momentumScore += 25;
  else if (momentum5 > 0.01) momentumScore += 15;
  else if (momentum5 > 0) momentumScore += 5;
  else if (momentum5 > -0.01) momentumScore -= 5;
  else if (momentum5 > -0.03) momentumScore -= 15;
  else momentumScore -= 25;

  // === 3. 趋势强度(MA20) ===
  let trendScore = 50;
  const ma20 = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
  const maDiff = (currentPrice - ma20) / ma20;
  if (maDiff > 0.05) trendScore += 25;
  else if (maDiff > 0.02) trendScore += 15;
  else if (maDiff > 0) trendScore += 5;
  else if (maDiff > -0.02) trendScore -= 5;
  else if (maDiff > -0.05) trendScore -= 15;
  else trendScore -= 25;

  // === 4. 历史模式: 同样形态出现后1小时(近似为1日)的胜率 ===
  let patternScore = 50;
  // 统计近3个月类似RSI+MACD组合后第二天的表现
  if (closes.length >= 60) {
    let winUp = 0, winDown = 0, totalUp = 0, totalDown = 0;
    for (let i = 30; i < closes.length - 1; i++) {
      const prevRsi = calcRSI(closes.slice(0, i + 1), 14);
      const prevMacd = calcMACD(closes.slice(0, i + 1));
      const nextReturn = (closes[i + 1] - closes[i]) / closes[i];

      if (Math.abs(prevRsi - rsi) < 5 && prevMacd.hist * macd.hist > 0) {
        if (nextReturn > 0) winUp++;
        if (nextReturn < 0) winDown++;
        if (nextReturn > 0) totalUp++;
        else totalDown++;
      }
    }
    if (totalUp + totalDown > 10) {
      const winRate = winUp / (totalUp + totalDown);
      patternScore = Math.round(winRate * 100);
    }
  }

  // === 5. 波动性参考 ===
  const recentReturns: number[] = [];
  for (let i = closes.length - 20; i < closes.length; i++) {
    if (i > 0) {
      recentReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  const meanReturn = recentReturns.reduce((s, v) => s + v, 0) / recentReturns.length;
  const stdReturn = Math.sqrt(
    recentReturns.reduce((s, v) => s + (v - meanReturn) ** 2, 0) / recentReturns.length
  );
  // 日波动转换为小时波动(经验值: 日波动的 1/√6.5 ≈ 0.39)
  const hourlyVol = stdReturn * 0.4;

  // === 综合评分 ===
  // 技术35% + 动量25% + 趋势20% + 模式20%
  const score = Math.round(
    technicalScore * 0.35 +
    momentumScore * 0.25 +
    trendScore * 0.20 +
    patternScore * 0.20
  );

  // === 预测方向和幅度 ===
  let direction: 'up' | 'down' | 'flat' = 'flat';
  let expectedChange = 0;

  if (score > 60) {
    direction = 'up';
    // 涨的概率和幅度,叠加市场热度
    const heatBoost = (marketHeat - 50) / 100;
    expectedChange = (score - 50) / 100 * 0.015 + heatBoost * 0.005;
  } else if (score < 40) {
    direction = 'down';
    const heatSuppress = (50 - marketHeat) / 100;
    expectedChange = -((50 - score) / 100) * 0.015 - heatSuppress * 0.005;
  } else {
    direction = 'flat';
    // 使用确定性随机代替 Math.random()
    expectedChange = (meanReturn * 0.05) + (rand() - 0.5) * 0.003;
  }

  expectedChange = Math.max(-hourlyVol * 2, Math.min(hourlyVol * 2, expectedChange));
  const predictedClose = currentPrice * (1 + expectedChange);

  // === 生成12个5分钟预测点 ===
  // 使用确定性的基准时间(基于最后交易日,固定到下午收盘后)
  // 这样同一天同一只股票无论何时点击,K线时间标签都一致
  const startTime = new Date(lastDate + 'T15:00:00');
  const timeSlots = generateTimeSlots(startTime, 12);
  const predictedBars: HourPrediction['predictedBars'] = [];

  // 生成平滑的预测路径(布朗运动 + 趋势)
  let price = currentPrice;
  const trendStep = (predictedClose - currentPrice) / 12;
  const drift = trendStep;
  const diffusion = hourlyVol / Math.sqrt(48); // 5分钟波动率

  for (let i = 0; i < 12; i++) {
    const prev = price;
    // 漂移 + 确定性扰动(种子随机)
    const noise = (rand() - 0.5) * 2 * diffusion;
    price = prev + drift + noise;
    const open = prev;
    const close = price;
    const high = Math.max(open, close) + Math.abs(noise) * 0.5;
    const low = Math.min(open, close) - Math.abs(noise) * 0.5;
    const avgVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5 / 48; // 5分钟均量
    predictedBars.push({
      time: timeSlots[i],
      open,
      high,
      low,
      close,
      volume: Math.round(avgVol * (0.7 + rand() * 0.6)),
    });
  }

  // 置信度: 模式匹配数越多、波动越小越置信
  const confidence = Math.max(0.3, Math.min(0.9,
    0.5 + (Math.abs(score - 50) / 100) * 0.3 - hourlyVol * 5
  ));

  return {
    predictedBars,
    score,
    direction,
    predictedClose,
    expectedChange: expectedChange * 100,
    confidence,
    factors: {
      technical: technicalScore,
      momentum: momentumScore,
      volatility: Math.round(hourlyVol * 1000),
      pattern: patternScore,
      trend: trendScore,
    },
    method: '技术指标(RSI/MACD/布林带 35%) + 短期动量(25%) + 趋势强度(20%) + 历史模式匹配(20%)',
  };
}

function defaultPrediction(price: number, reason: string): HourPrediction {
  const startTime = new Date();
  const timeSlots = generateTimeSlots(startTime, 12);
  return {
    predictedBars: timeSlots.map(t => ({
      time: t,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
    })),
    score: 50,
    direction: 'flat',
    predictedClose: price,
    expectedChange: 0,
    confidence: 0,
    factors: { technical: 50, momentum: 50, volatility: 0, pattern: 50, trend: 50 },
    method: reason,
  };
}
