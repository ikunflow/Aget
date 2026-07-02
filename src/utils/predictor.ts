import type { DailyBar, IndicatorData, PredictionResult } from './types';

// 预测股票下一走势
export function predict(bars: DailyBar[], indicators: IndicatorData): PredictionResult {
  const len = bars.length;
  if (len === 0) {
    return { signal: 'neutral', confidence: 50, supportPrice: 0, resistancePrice: 0, stopLossPrice: 0, takeProfitPrice: 0, score: 50 };
  }

  const last = bars[len - 1];
  const lastClose = last.close;
  let score = 50;

  // 1. 均线趋势（权重20%）
  const { ma5, ma10, ma20, ma60, macd, kdj, boll, rsi } = indicators;
  const v = (arr: number[], idx: number) => {
    const val = arr[idx];
    return isNaN(val) ? null : val;
  };

  const ma5v = v(ma5, len - 1);
  const ma10v = v(ma10, len - 1);
  const ma20v = v(ma20, len - 1);
  const ma60v = v(ma60, len - 1);

  if (ma5v && ma20v) {
    if (ma5v > ma20v) score += 8;
    else score -= 8;
  }
  if (ma10v && ma60v) {
    if (ma10v > ma60v) score += 5;
    else score -= 5;
  }
  if (ma5v && ma10v && ma20v) {
    if (ma5v > ma10v && ma10v > ma20v) score += 7; // 多头排列
    else if (ma5v < ma10v && ma10v < ma20v) score -= 7; // 空头排列
  }

  // 2. MACD信号（权重20%）
  const difLast = v(macd.dif, len - 1);
  const deaLast = v(macd.dea, len - 1);
  const difPrev = v(macd.dif, len - 2);
  const deaPrev = v(macd.dea, len - 2);

  if (difLast !== null && deaLast !== null) {
    if (difLast > deaLast) score += 5;
    else score -= 5;
    // 金叉
    if (difPrev !== null && deaPrev !== null && difPrev <= deaPrev && difLast > deaLast) {
      score += 10;
    }
    // 死叉
    if (difPrev !== null && deaPrev !== null && difPrev >= deaPrev && difLast < deaLast) {
      score -= 10;
    }
  }

  // 3. KDJ信号（权重20%）
  const kLast = v(kdj.k, len - 1);
  const dLast = v(kdj.d, len - 1);

  if (kLast !== null && dLast !== null) {
    if (kLast < 20) score += 10; // 超卖
    else if (kLast > 80) score -= 10; // 超买
    else if (kLast < 40) score += 3;
    else if (kLast > 60) score -= 3;

    if (kLast > dLast) score += 3;
    else score -= 3;
  }

  // 4. RSI信号（权重15%）
  const rsiLast = v(rsi, len - 1);
  if (rsiLast !== null) {
    if (rsiLast < 30) score += 10;
    else if (rsiLast > 70) score -= 10;
    else if (rsiLast < 45) score += 3;
    else if (rsiLast > 55) score -= 3;
  }

  // 5. 布林带信号（权重15%）
  const bollUpper = v(boll.upper, len - 1);
  const bollLower = v(boll.lower, len - 1);
  const bollMid = v(boll.mid, len - 1);

  if (bollUpper !== null && bollLower !== null) {
    if (lastClose <= bollLower) score += 10;
    else if (lastClose >= bollUpper) score -= 10;
    else if (lastClose < bollMid) score += 3;
    else score -= 3;
  }

  // 6. 量价配合（权重10%）
  if (len >= 2) {
    const volChange = bars[len - 1].volume / bars[len - 2].volume;
    const priceChange = (lastClose - bars[len - 2].close) / bars[len - 2].close;
    if (priceChange > 0 && volChange > 1.2) score += 5; // 放量上涨
    if (priceChange < 0 && volChange > 1.2) score -= 5; // 放量下跌
  }

  // 限制分数范围
  score = Math.max(0, Math.min(100, score));

  // 确定信号方向
  let signal: 'bullish' | 'bearish' | 'neutral';
  if (score > 60) signal = 'bullish';
  else if (score < 40) signal = 'bearish';
  else signal = 'neutral';

  // 置信度
  const confidence = signal === 'neutral'
    ? Math.round(100 - Math.abs(score - 50) * 2)
    : Math.round(Math.abs(score - 50) * 2);

  // 计算关键价位
  const recentHighs = bars.slice(-20).map(b => b.high);
  const recentLows = bars.slice(-20).map(b => b.low);
  const resistancePrice = Math.round(Math.max(...recentHighs) * 100) / 100;
  const supportPrice = Math.round(Math.min(...recentLows) * 100) / 100;
  const stopLossPrice = Math.round(supportPrice * 0.97 * 100) / 100;
  const takeProfitPrice = Math.round(resistancePrice * 1.05 * 100) / 100;

  return {
    signal,
    confidence: Math.max(10, Math.min(95, confidence)),
    supportPrice,
    resistancePrice,
    stopLossPrice,
    takeProfitPrice,
    score,
  };
}
