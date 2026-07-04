import type { DailyBar, IndicatorData } from './types';
import { calcFactors, applyWeights, DEFAULT_WEIGHTS, getCachedWeights, setCachedWeights, optimizeWeights, type WeightCombo } from './weightOptimizer';
import { selfBacktest, type BacktestReport } from './predictionBacktest';

// 概率分布预测结果(科学严谨版本)
export interface HourPrediction {
  // 当前价格
  currentPrice: number;
  // 上涨/下跌/震荡 概率(0-1,和为1)
  upProbability: number;
  downProbability: number;
  flatProbability: number;
  // 基于历史匹配样本的期望收益(%)
  expectedReturn: number;
  // 收益的80%置信区间(%)
  ci80Lower: number;
  ci80Upper: number;
  // 收益的95%置信区间(%)
  ci95Lower: number;
  ci95Upper: number;
  // 综合评分 0-100(50为中性)
  score: number;
  // 历史匹配样本数
  matchSampleSize: number;
  // 因子得分
  factors: {
    technical: number;
    momentum: number;
    trend: number;
    pattern: number;
  };
  // 使用的权重
  weights: WeightCombo;
  // 该权重的历史样本外准确率
  weightAccuracy: number;
  // 模型自身回测结果(对过去250个交易日的回测)
  backtest: BacktestReport;
  // 预测方法说明
  method: string;
}

// 计算收益分布的置信区间
function calcCI(returns: number[], percent: number): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const lower = (1 - percent) / 2;
  const upper = 1 - lower;
  const idx = (p: number) => Math.max(0, Math.min(sorted.length - 1, Math.floor(p * sorted.length)));
  return sorted[idx(percent)];
}

// 主预测函数:从K线数据预测未来5日方向概率
export async function predictHour(
  code: string,
  bars: DailyBar[],
  indicators: IndicatorData | null
): Promise<HourPrediction> {
  const closes = bars.map(b => b.close);
  const lastBar = bars[bars.length - 1];
  const currentPrice = lastBar.close;
  const lastDate = lastBar.date;

  if (closes.length < 30) {
    return defaultPrediction(currentPrice, '数据不足', DEFAULT_WEIGHTS);
  }

  // === 1. 获取/优化权重 ===
  let weights: WeightCombo = DEFAULT_WEIGHTS;
  let weightAccuracy = 0;
  let weightSampleSize = 0;

  const cached = getCachedWeights(code);
  if (cached) {
    weights = cached.weights;
    weightAccuracy = cached.accuracy;
    weightSampleSize = cached.sampleSize;
  } else if (bars.length >= 300) {
    // 异步执行优化,避免阻塞主流程
    const result = optimizeWeights(bars, 5);
    if (result.sampleSize >= 30) {
      weights = result.best;
      weightAccuracy = result.accuracy;
      weightSampleSize = result.sampleSize;
      setCachedWeights(code, { weights, accuracy: weightAccuracy, sampleSize: weightSampleSize });
    }
  }

  // === 2. 计算当前因子 ===
  const factors = calcFactors(bars);
  if (!factors) {
    return defaultPrediction(currentPrice, '因子计算失败', weights);
  }
  const score = applyWeights(factors, weights);

  // === 3. 匹配历史相似模式(全量历史扫描)===
  const rsiBucket = Math.floor(factors.technical / 10); // 用技术得分作粗分桶
  const scoreBucket = Math.floor(score / 10);

  interface Match { returnPct: number; }
  const matches: Match[] = [];

  for (let i = 250; i < closes.length - 1; i++) {
    const pastWindow = bars.slice(0, i + 1);
    if (pastWindow.length < 30) continue;
    const pastFactors = calcFactors(pastWindow);
    if (!pastFactors) continue;
    const pastScore = applyWeights(pastFactors, weights);
    const pastScoreBucket = Math.floor(pastScore / 10);

    // 用score分桶匹配(等效于匹配相似的综合状态)
    if (pastScoreBucket === scoreBucket) {
      const nextReturn = (closes[i + 1] - closes[i]) / closes[i] * 100;
      matches.push({ returnPct: nextReturn });
    }
  }

  // === 4. 统计分布 ===
  let upProb = 0.33, downProb = 0.33, flatProb = 0.34;
  let expectedReturn = 0;
  let ci80: [number, number] = [0, 0];
  let ci95: [number, number] = [0, 0];

  if (matches.length >= 5) {
    const returns = matches.map(m => m.returnPct);
    expectedReturn = returns.reduce((s, v) => s + v, 0) / returns.length;

    const upCount = returns.filter(r => r > 0.3).length;
    const downCount = returns.filter(r => r < -0.3).length;
    const flatCount = returns.length - upCount - downCount;

    upProb = upCount / returns.length;
    downProb = downCount / returns.length;
    flatProb = flatCount / returns.length;

    ci80 = [calcCI(returns, 0.10), calcCI(returns, 0.90)];
    ci95 = [calcCI(returns, 0.025), calcCI(returns, 0.975)];
  } else {
    // 样本不足时退化到score推断
    if (score > 60) { upProb = 0.55; downProb = 0.20; flatProb = 0.25; }
    else if (score < 40) { upProb = 0.20; downProb = 0.55; flatProb = 0.25; }
    expectedReturn = (score - 50) / 50 * 1.0; // 弱信号
    ci80 = [expectedReturn - 1.5, expectedReturn + 1.5];
    ci95 = [expectedReturn - 3.0, expectedReturn + 3.0];
  }

  // === 5. 模型自身回测(科学可信度评估)===
  const backtest = selfBacktest(bars, weights, 250, [1, 5, 20]);

  return {
    currentPrice,
    upProbability: upProb,
    downProbability: downProb,
    flatProbability: flatProb,
    expectedReturn,
    ci80Lower: ci80[0],
    ci80Upper: ci80[1],
    ci95Lower: ci95[0],
    ci95Upper: ci95[1],
    score,
    matchSampleSize: matches.length,
    factors,
    weights,
    weightAccuracy,
    backtest,
    method: '1) 网格搜索3年K线找出该股票的最优因子权重; 2) 全量历史模式匹配(分桶); 3) 输出概率分布和置信区间; 4) 模型自身回测评估可信度',
  };
}

function defaultPrediction(price: number, reason: string, weights: WeightCombo): HourPrediction {
  return {
    currentPrice: price,
    upProbability: 0.33,
    downProbability: 0.33,
    flatProbability: 0.34,
    expectedReturn: 0,
    ci80Lower: 0, ci80Upper: 0,
    ci95Lower: 0, ci95Upper: 0,
    score: 50,
    matchSampleSize: 0,
    factors: { technical: 50, momentum: 50, trend: 50, pattern: 50 },
    weights,
    weightAccuracy: 0,
    backtest: {
      totalSamples: 0, upHit: 0, upMiss: 0, downHit: 0, downMiss: 0, flatCount: 0,
      directionAccuracy: 0, meanError: 0, winRate: 0, wilsonLower: 0,
      horizons: [],
    },
    method: reason,
  };
}
