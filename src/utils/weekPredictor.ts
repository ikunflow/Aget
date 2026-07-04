import type { DailyBar, IndicatorData, WeekPrediction, PredictedBar, PredictionHorizon } from './types';

// 确定性伪随机数(保证相同输入→相同输出)
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

function makeSeededRand(code: string, lastDate: string, price: number): () => number {
  return mulberry32(hashString(`${code}|${lastDate}|${price.toFixed(4)}`));
}

// 获取未来N个交易日日期（跳过周末）
function getNextTradeDates(lastDate: string, count: number): string[] {
  const dates: string[] = [];
  const d = new Date(lastDate);
  d.setDate(d.getDate() + 1);

  while (dates.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// 3年量化规律分析引擎
function analyzeQuantPatterns(bars: DailyBar[], indicators: IndicatorData) {
  const len = bars.length;
  if (len < 60) {
    return {
      trendScore: 50,
      momentumScore: 50,
      meanReversionScore: 50,
      seasonalityScore: 50,
      volatility: 0.02,
      stdDaily: 0.02,
    };
  }

  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);

  // 日收益率统计
  const dailyReturns: number[] = [];
  for (let i = 1; i < len; i++) {
    dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const meanDaily = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const stdDaily = Math.sqrt(dailyReturns.reduce((s, r) => s + (r - meanDaily) ** 2, 0) / dailyReturns.length);

  // 动量得分
  let momentumUp = 0, momentumTotal = 0;
  const lookback = 10;
  for (let i = lookback; i < len - 5; i++) {
    const pastReturn = (closes[i - 1] - closes[i - lookback]) / closes[i - lookback];
    const futureReturn = (closes[Math.min(i + 4, len - 1)] - closes[i]) / closes[i];
    if (pastReturn > 0.02) {
      momentumTotal++;
      if (futureReturn > 0) momentumUp++;
    } else if (pastReturn < -0.02) {
      momentumTotal++;
      if (futureReturn < 0) momentumUp++;
    }
  }
  const momentumScore = momentumTotal > 20 ? Math.round((momentumUp / momentumTotal) * 100) : 50;

  // 均值回归得分
  let revertCount = 0, revertTotal = 0;
  const ma60 = indicators.ma60;
  for (let i = 60; i < len - 5; i++) {
    if (isNaN(ma60[i])) continue;
    const deviation = (closes[i] - ma60[i]) / ma60[i];
    if (Math.abs(deviation) > 0.05) {
      revertTotal++;
      const futureReturn = (closes[Math.min(i + 4, len - 1)] - closes[i]) / closes[i];
      if (deviation > 0 && futureReturn < 0) revertCount++;
      if (deviation < 0 && futureReturn > 0) revertCount++;
    }
  }
  const meanReversionScore = revertTotal > 20 ? Math.round((revertCount / revertTotal) * 100) : 50;

  // 季节性得分
  const currentMonth = new Date(bars[len - 1].date).getMonth();
  const monthReturns: number[] = [];
  for (let i = 22; i < len; i++) {
    if (new Date(bars[i].date).getMonth() === currentMonth) {
      monthReturns.push((closes[i] - closes[i - 22]) / closes[i - 22]);
    }
  }
  const avgMonthReturn = monthReturns.length > 0 ? monthReturns.reduce((s, r) => s + r, 0) / monthReturns.length : 0;
  const seasonalityScore = Math.round(50 + avgMonthReturn * 500);

  // 技术指标综合得分
  const v = (arr: number[], idx: number) => {
    const val = arr[idx];
    return isNaN(val) ? null : val;
  };

  let techScore = 50;
  const { ma5, ma10, ma20, macd, kdj, boll, rsi } = indicators;

  const ma5v = v(ma5, len - 1);
  const ma10v = v(ma10, len - 1);
  const ma20v = v(ma20, len - 1);
  if (ma5v && ma10v && ma20v) {
    if (ma5v > ma10v && ma10v > ma20v) techScore += 15;
    else if (ma5v < ma10v && ma10v < ma20v) techScore -= 15;
  }

  const difLast = v(macd.dif, len - 1);
  const deaLast = v(macd.dea, len - 1);
  if (difLast !== null && deaLast !== null) {
    if (difLast > deaLast) techScore += 10;
    else techScore -= 10;
    const histLast = difLast - deaLast;
    const difPrev = v(macd.dif, len - 2);
    const deaPrev = v(macd.dea, len - 2);
    if (difPrev !== null && deaPrev !== null) {
      const histPrev = difPrev - deaPrev;
      if (histLast > histPrev) techScore += 5;
      else techScore -= 5;
    }
  }

  const rsiLast = v(rsi, len - 1);
  if (rsiLast !== null) {
    if (rsiLast < 30) techScore += 10;
    else if (rsiLast > 70) techScore -= 10;
  }

  const kLast = v(kdj.k, len - 1);
  if (kLast !== null) {
    if (kLast < 20) techScore += 8;
    else if (kLast > 80) techScore -= 8;
  }

  const bollUpper = v(boll.upper, len - 1);
  const bollLower = v(boll.lower, len - 1);
  const bollMid = v(boll.mid, len - 1);
  const lastClose = closes[len - 1];
  if (bollUpper && bollLower && bollMid) {
    const bollWidth = bollUpper - bollLower;
    const pos = (lastClose - bollLower) / bollWidth;
    if (pos < 0.2) techScore += 8;
    else if (pos > 0.8) techScore -= 8;
  }

  if (len >= 5) {
    const avgVol5 = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
    const avgVol20 = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
    if (avgVol20 > 0) {
      const volRatio = avgVol5 / avgVol20;
      const priceChange5 = (closes[len - 1] - closes[len - 5]) / closes[len - 5];
      if (priceChange5 > 0 && volRatio > 1.3) techScore += 8;
      if (priceChange5 < 0 && volRatio > 1.3) techScore -= 8;
    }
  }

  techScore = Math.max(0, Math.min(100, techScore));

  const recentBias = meanDaily > 0 ? Math.min(meanDaily * 2000, 15) : Math.max(meanDaily * 2000, -15);
  const trendScore = Math.max(0, Math.min(100,
    techScore * 0.4 + momentumScore * 0.2 + meanReversionScore * 0.15 + seasonalityScore * 0.15 + (50 + recentBias) * 0.1
  ));

  return {
    trendScore: Math.round(trendScore),
    momentumScore,
    meanReversionScore,
    seasonalityScore,
    volatility: Math.max(0.005, stdDaily),
    stdDaily,
  };
}

// 生成预测K线
function generatePredictedBars(
  code: string,
  lastBar: DailyBar,
  quant: ReturnType<typeof analyzeQuantPatterns>,
  marketHeat: number,
  futureDates: string[],
): PredictedBar[] {
  const { trendScore, volatility } = quant;
  const quantWeight = 0.7;
  const marketWeight = 0.3;
  const combinedScore = trendScore * quantWeight + marketHeat * marketWeight;
  const expectedDailyReturn = ((combinedScore - 50) / 50) * volatility * 0.8;

  // 确定性种子随机
  const rand = makeSeededRand(code, lastBar.date, lastBar.close);

  const predicted: PredictedBar[] = [];
  let prevClose = lastBar.close;
  const avgVol = lastBar.volume;

  for (let i = 0; i < futureDates.length; i++) {
    const uncertaintyScale = 1 + i * 0.15;
    const randomComponent = (rand() - 0.5) * 2 * volatility * uncertaintyScale * 0.6;
    const dayReturn = expectedDailyReturn + randomComponent;
    const clampedReturn = Math.max(-0.1, Math.min(0.1, dayReturn));

    const close = Math.round(prevClose * (1 + clampedReturn) * 100) / 100;
    const open = Math.round(prevClose * (1 + (rand() - 0.5) * volatility * 0.5) * 100) / 100;
    const intraVolatility = volatility * (1 + i * 0.1);
    const high = Math.round(Math.max(open, close) * (1 + rand() * intraVolatility * 0.8) * 100) / 100;
    const low = Math.round(Math.min(open, close) * (1 - rand() * intraVolatility * 0.8) * 100) / 100;
    const volBias = combinedScore > 55 ? 1.05 : combinedScore < 45 ? 0.95 : 1;
    const volume = Math.round(avgVol * volBias * (0.9 + rand() * 0.2));

    predicted.push({ date: futureDates[i], open, high, low, close, volume, isPredicted: true });
    prevClose = close;
  }

  return predicted;
}

// 计算买卖价位和持仓天数
function calcTradingPlan(
  bars: DailyBar[],
  indicators: IndicatorData,
  predictedBars: PredictedBar[],
  horizon: PredictionHorizon,
  quant: ReturnType<typeof analyzeQuantPatterns>,
  combinedScore: number,
) {
  const len = bars.length;
  const lastClose = bars[len - 1].close;
  const { volatility, stdDaily } = quant;

  // 短期：5个交易日；长期：20个交易日（约1个月）
  const holdDays = horizon === 'short' ? 5 : 20;

  // 支撑位和压力位
  const lookback = horizon === 'short' ? 20 : 60;
  const recentHighs = bars.slice(-lookback).map(b => b.high);
  const recentLows = bars.slice(-lookback).map(b => b.low);
  const recentHigh = Math.max(...recentHighs);
  const recentLow = Math.min(...recentLows);

  const v = (arr: number[], idx: number) => {
    const val = arr[idx];
    return isNaN(val) ? null : val;
  };

  // 布林带
  const bollUpper = v(indicators.boll.upper, len - 1);
  const bollLower = v(indicators.boll.lower, len - 1);
  const bollMid = v(indicators.boll.mid, len - 1);

  // MA均线
  const ma5v = v(indicators.ma5, len - 1);
  const ma10v = v(indicators.ma10, len - 1);
  const ma20v = v(indicators.ma20, len - 1);
  const ma60v = v(indicators.ma60, len - 1);

  // 买入价位：基于支撑位
  let buyPrice: number;
  if (horizon === 'short') {
    // 短期：MA5或近期低点附近
    const support = recentLow * 0.98;
    buyPrice = ma5v ? Math.min(ma5v * 0.99, lastClose * 0.97) : support;
  } else {
    // 长期：MA20或boll下轨附近
    const support = bollLower || recentLow;
    buyPrice = ma20v ? Math.min(ma20v * 0.97, lastClose * 0.93) : support;
  }
  buyPrice = Math.round(buyPrice * 100) / 100;

  // 卖价：基于压力位
  let sellPrice: number;
  if (horizon === 'short') {
    // 短期：近期高点或boll上轨
    sellPrice = Math.max(recentHigh, bollUpper || recentHigh);
  } else {
    // 长期：基于波动率的目标收益
    const targetReturn = volatility * Math.sqrt(20) * 2; // 2倍标准差
    sellPrice = lastClose * (1 + Math.max(targetReturn, 0.1));
    // 不超过近期高点上方20%
    sellPrice = Math.min(sellPrice, recentHigh * 1.2);
  }
  sellPrice = Math.round(sellPrice * 100) / 100;

  // 止损价
  let stopLossPrice: number;
  if (horizon === 'short') {
    stopLossPrice = Math.round(buyPrice * 0.95 * 100) / 100; // -5%
  } else {
    stopLossPrice = Math.round(buyPrice * 0.90 * 100) / 100; // -10%
  }

  // 预期收益率
  const expectedReturn = Math.round(((sellPrice - buyPrice) / buyPrice) * 100 * 100) / 100;

  // 风险等级
  const riskRatio = Math.abs((buyPrice - stopLossPrice) / buyPrice); // 止损比例
  let riskLevel: 'low' | 'medium' | 'high';
  if (horizon === 'short') {
    riskLevel = riskRatio < 0.04 ? 'low' : riskRatio < 0.06 ? 'medium' : 'high';
  } else {
    riskLevel = riskRatio < 0.08 ? 'low' : riskRatio < 0.12 ? 'medium' : 'high';
  }

  return { buyPrice, sellPrice, stopLossPrice, holdDays, expectedReturn, riskLevel };
}

// 生成摘要
function generateSummary(
  horizon: PredictionHorizon,
  quant: ReturnType<typeof analyzeQuantPatterns>,
  marketHeat: number,
  combinedScore: number,
  plan: { buyPrice: number; sellPrice: number; stopLossPrice: number; holdDays: number; expectedReturn: number; riskLevel: string },
  lastClose: number,
  predictedBars: PredictedBar[],
): string {
  const horizonWord = horizon === 'short' ? '短期（5个交易日）' : '长期（20个交易日）';
  const trendWord = combinedScore > 65 ? '偏多' : combinedScore < 35 ? '偏空' : '震荡';
  const momentumWord = quant.momentumScore > 60 ? '动量较强' : quant.momentumScore < 40 ? '动量衰减' : '动量一般';
  const heatWord = marketHeat > 65 ? '大盘偏热' : marketHeat < 35 ? '大盘偏冷' : '大盘温和';
  const riskWord = plan.riskLevel === 'low' ? '低风险' : plan.riskLevel === 'medium' ? '中风险' : '高风险';

  const lastPred = predictedBars[predictedBars.length - 1];
  const predReturn = lastClose > 0 ? ((lastPred.close - lastClose) / lastClose * 100).toFixed(2) : '0';

  return `${horizonWord}预测：综合评分${combinedScore.toFixed(0)}分（${trendWord}），` +
    `预计${predReturn > '0' ? '上涨' : '下跌'}${Math.abs(parseFloat(predReturn))}%。` +
    `建议在${plan.buyPrice.toFixed(2)}元附近买入，目标卖出价${plan.sellPrice.toFixed(2)}元，` +
    `止损价${plan.stopLossPrice.toFixed(2)}元，持仓约${plan.holdDays}天，` +
    `预期收益${plan.expectedReturn}%（${riskWord}）。${momentumWord}，${heatWord}。`;
}

// 主预测函数
export function predictWeek(
  code: string,
  bars: DailyBar[],
  indicators: IndicatorData,
  marketHeat: number = 50,
  marketLabel: string = '温和',
  horizon: PredictionHorizon = 'short',
): WeekPrediction {
  const len = bars.length;
  const predictDays = horizon === 'short' ? 5 : 20;

  if (len < 20) {
    const lastDate = len > 0 ? bars[len - 1].date : new Date().toISOString().slice(0, 10);
    return {
      horizon,
      dates: getNextTradeDates(lastDate, predictDays),
      bars: [],
      trendScore: 50,
      volatility: 0.02,
      quantWeight: 70,
      marketHeat,
      marketLabel,
      summary: '数据不足，无法预测',
      buyPrice: 0, sellPrice: 0, stopLossPrice: 0, holdDays: predictDays,
      expectedReturn: 0, riskLevel: 'medium',
    };
  }

  const lastBar = bars[len - 1];
  const futureDates = getNextTradeDates(lastBar.date, predictDays);
  const quant = analyzeQuantPatterns(bars, indicators);
  const predictedBars = generatePredictedBars(code, lastBar, quant, marketHeat, futureDates);

  const quantWeight = 0.7;
  const marketWeight = 0.3;
  const combinedScore = quant.trendScore * quantWeight + marketHeat * marketWeight;

  const plan = calcTradingPlan(bars, indicators, predictedBars, horizon, quant, combinedScore);
  const summary = generateSummary(horizon, quant, marketHeat, combinedScore, plan, lastBar.close, predictedBars);

  return {
    horizon,
    dates: futureDates,
    bars: predictedBars,
    trendScore: quant.trendScore,
    volatility: quant.volatility,
    quantWeight: 70,
    marketHeat,
    marketLabel,
    summary,
    ...plan,
  };
}
