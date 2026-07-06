import type { DailyBar, IndicatorData, PredictionHorizon, WeekPrediction } from './types';
import {
  calcFactors, applyWeights, DEFAULT_WEIGHTS,
  getCachedWeights, setCachedWeights, optimizeWeights, type WeightCombo
} from './weightOptimizer';
import { selfBacktest, type BacktestReport } from './predictionBacktest';

// 简单的"下个交易日"日期生成(避免引入额外工具)
function getNextTradeDates(lastDate: string, count: number): string[] {
  const dates: string[] = [];
  const d = new Date(lastDate + 'T00:00:00');
  let added = 0;
  while (added < count) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    dates.push(d.toISOString().slice(0, 10));
    added++;
  }
  return dates;
}

export type { WeekPrediction };

// 计算分位数
function quantile(sortedArr: number[], q: number): number {
  if (sortedArr.length === 0) return 0;
  const idx = Math.max(0, Math.min(sortedArr.length - 1, Math.floor(q * sortedArr.length)));
  return sortedArr[idx];
}

function calcCI(returns: number[], percent: number): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  if (percent < 0.5) return quantile(sorted, percent);
  return quantile(sorted, percent);
}

// 主预测函数
export async function predictWeek(
  code: string,
  bars: DailyBar[],
  indicators: IndicatorData,
  marketHeat: number = 50,
  marketLabel: string = '温和',
  horizon: PredictionHorizon = 'short',
): Promise<WeekPrediction> {
  const len = bars.length;
  const days = horizon === 'short' ? 5 : horizon === 'long' ? 20 : 1;

  if (len < 30) {
    return defaultPrediction(code, bars, marketHeat, marketLabel, horizon, days, DEFAULT_WEIGHTS);
  }

  // === 1. 权重(从缓存或新优化)===
  let weights: WeightCombo = DEFAULT_WEIGHTS;
  let weightAccuracy = 0;
  let weightSampleSize = 0;
  const cached = getCachedWeights(`${code}_${days}d`);
  if (cached) {
    weights = cached.weights;
    weightAccuracy = cached.accuracy;
    weightSampleSize = cached.sampleSize;
  } else if (len >= 300) {
    const result = optimizeWeights(bars, days);
    if (result.sampleSize >= 30) {
      weights = result.best;
      weightAccuracy = result.accuracy;
      weightSampleSize = result.sampleSize;
      setCachedWeights(`${code}_${days}d`, { weights, accuracy: weightAccuracy, sampleSize: weightSampleSize });
    }
  }

  // === 2. 当前因子 ===
  const factors = calcFactors(bars);
  if (!factors) {
    return defaultPrediction(code, bars, marketHeat, marketLabel, horizon, days, weights);
  }
  const baseScore = applyWeights(factors, weights);

  // 大盘热度作为修正(0.7量化 + 0.3热度)
  const combinedScore = baseScore * 0.7 + marketHeat * 0.3;

  // === 3. 历史相似模式匹配(全量历史)===
  const scoreBucket = Math.floor(combinedScore / 10);

  const matches: { returnPct: number }[] = [];

  for (let i = 250; i < len - days; i++) {
    const pastWindow = bars.slice(0, i + 1);
    if (pastWindow.length < 30) continue;
    const pastFactors = calcFactors(pastWindow);
    if (!pastFactors) continue;
    const pastBaseScore = applyWeights(pastFactors, weights);
    // 用近似marketHeat为50的历史,避免未来函数
    const pastCombined = pastBaseScore * 0.7 + 50 * 0.3;
    const pastScoreBucket = Math.floor(pastCombined / 10);
    if (pastScoreBucket === scoreBucket) {
      const futureReturn = (bars[i + days].close - bars[i].close) / bars[i].close * 100;
      matches.push({ returnPct: futureReturn });
    }
  }

  // === 4. 分布统计 ===
  let upProb = 0.33, downProb = 0.33, flatProb = 0.34;
  let expectedReturn = 0;
  let ci80: [number, number] = [0, 0];
  let ci95: [number, number] = [0, 0];

  if (matches.length >= 5) {
    const returns = matches.map(m => m.returnPct);
    expectedReturn = returns.reduce((s, v) => s + v, 0) / returns.length;
    // 涨跌幅阈值按 days 自适应(days=1 用 0.2%, days=5 用 0.5%, days=20 用 1%)
    const moveThresh = days === 1 ? 0.2 : days === 5 ? 0.5 : 1.0;
    const upCount = returns.filter(r => r > moveThresh).length;
    const downCount = returns.filter(r => r < -moveThresh).length;
    const flatCount = returns.length - upCount - downCount;
    upProb = upCount / returns.length;
    downProb = downCount / returns.length;
    flatProb = flatCount / returns.length;
    ci80 = [calcCI(returns, 0.10), calcCI(returns, 0.90)];
    ci95 = [calcCI(returns, 0.025), calcCI(returns, 0.975)];
  } else {
    // 样本不足时,弱信号
    if (combinedScore > 60) { upProb = 0.50; downProb = 0.25; flatProb = 0.25; }
    else if (combinedScore < 40) { upProb = 0.25; downProb = 0.50; flatProb = 0.25; }
    const baseMove = days === 1 ? 0.6 : days === 5 ? 2 : 5;
    expectedReturn = (combinedScore - 50) / 50 * baseMove;
    ci80 = [expectedReturn - days * 0.6, expectedReturn + days * 0.6];
    ci95 = [expectedReturn - days * 1.2, expectedReturn + days * 1.2];
  }

  // === 5. 模型自身回测 ===
  const backtest = selfBacktest(bars, weights, 250, [1, 5, 20]);

  // === 6. 业务字段(基于概率结果计算建议价)===
  const currentPrice = bars[len - 1].close;
  // 买入位: 期望收益为正时, 80%置信下沿作为保守建仓价(实际不是价格预测,而是概率下的执行价)
  // 卖出位: 80%置信上沿的一半(折中)
  // 止损位: 95%置信下沿的一半
  const buyPrice = expectedReturn > 0
    ? currentPrice * (1 + Math.min(0, ci80[0]) / 100 * 0.5)
    : currentPrice;
  const sellPrice = currentPrice * (1 + ci80[1] / 100 * 0.5);
  const stopLossPrice = currentPrice * (1 + ci95[0] / 100 * 0.5);

  // 风险等级: 用95%置信区间宽度
  const ci95Width = ci95[1] - ci95[0];
  let riskLevel: 'low' | 'medium' | 'high';
  if (ci95Width < 8) riskLevel = 'low';
  else if (ci95Width < 15) riskLevel = 'medium';
  else riskLevel = 'high';

  // 文案
  const direction = upProb > downProb ? '偏多' : downProb > upProb ? '偏空' : '震荡';
  const summary = `基于${matches.length}个历史相似样本,该股未来${days}日${direction}概率${Math.round(Math.max(upProb, downProb) * 100)}%,期望收益${expectedReturn >= 0 ? '+' : ''}${expectedReturn.toFixed(2)}%(80%区间[${ci80[0].toFixed(1)}%, ${ci80[1].toFixed(1)}%])。模型自身回测方向准确率${(backtest.directionAccuracy * 100).toFixed(1)}%(样本${backtest.totalSamples})。`;

  return {
    horizon,
    days,
    currentPrice,
    upProbability: upProb,
    downProbability: downProb,
    flatProbability: flatProb,
    expectedReturn,
    ci80Lower: ci80[0],
    ci80Upper: ci80[1],
    ci95Lower: ci95[0],
    ci95Upper: ci95[1],
    score: combinedScore,
    matchSampleSize: matches.length,
    weights,
    weightAccuracy,
    backtest,
    buyPrice,
    sellPrice,
    stopLossPrice,
    holdDays: days,
    expectedReturnDisplay: expectedReturn,
    riskLevel,
    summary,
    marketHeat,
    marketLabel,
    quantWeight: 70,
    method: '1) 网格搜索3年K线优化因子权重(权重按股票+周期分别缓存); 2) 相似综合评分分桶匹配全量历史; 3) 输出方向概率+置信区间; 4) 模型自身回测报告可信度',
    // 兼容旧字段
    dates: [],
    bars: [],
    trendScore: combinedScore,
    volatility: Math.abs(ci95[1] - ci95[0]) / 4, // 估计波动率
  };
}

function defaultPrediction(
  code: string, bars: DailyBar[], marketHeat: number, marketLabel: string,
  horizon: PredictionHorizon, days: number, weights: WeightCombo
): WeekPrediction {
  const currentPrice = bars.length > 0 ? bars[bars.length - 1].close : 0;
  const lastDate = bars.length > 0 ? bars[bars.length - 1].date : new Date().toISOString().slice(0, 10);
  return {
    horizon,
    days,
    currentPrice,
    upProbability: 0.33, downProbability: 0.33, flatProbability: 0.34,
    expectedReturn: 0,
    ci80Lower: 0, ci80Upper: 0, ci95Lower: 0, ci95Upper: 0,
    score: 50,
    matchSampleSize: 0,
    weights, weightAccuracy: 0,
    backtest: { totalSamples: 0, upHit: 0, upMiss: 0, downHit: 0, downMiss: 0, flatCount: 0, directionAccuracy: 0, meanError: 0, winRate: 0, wilsonLower: 0, horizons: [] },
    buyPrice: currentPrice, sellPrice: currentPrice, stopLossPrice: currentPrice,
    holdDays: days, expectedReturnDisplay: 0, riskLevel: 'medium',
    summary: '数据不足,无法给出有意义的预测', marketHeat, marketLabel, quantWeight: 70,
    method: '数据不足',
    dates: getNextTradeDates(lastDate, days),
    bars: [],
    trendScore: 50,
    volatility: 0.02,
  };
}
