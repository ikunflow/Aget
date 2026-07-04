import type { DailyBar } from './types';
import { calcFactors, applyWeights, DEFAULT_WEIGHTS, type WeightCombo } from './weightOptimizer';

// 模型自身回测:对过去N个交易日逐日运行预测,统计实际命中率
export interface BacktestReport {
  totalSamples: number;
  upHit: number;          // 预测上涨且实际上涨
  upMiss: number;         // 预测上涨但实际下跌
  downHit: number;        // 预测下跌且实际下跌
  downMiss: number;       // 预测下跌但实际上涨
  flatCount: number;      // 预测震荡次数
  directionAccuracy: number;  // 方向命中率
  meanError: number;          // 平均方向误差
  winRate: number;            // 实际收益为正的比例
  // 显著性:假设随机预测(50%命中),实际命中率是否显著高
  // 用 Wilson 区间下界,大于0.5即认为"统计学上不输于随机"
  wilsonLower: number;
  // 1日 vs 5日 vs 20日对比
  horizons: {
    days: number;
    accuracy: number;
    sampleSize: number;
  }[];
}

function wilsonLowerBound(successes: number, total: number, z: number = 1.96): number {
  if (total === 0) return 0;
  const p = successes / total;
  const denom = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denom;
  const margin = (z * Math.sqrt(p * (1 - p) / total + (z * z) / (4 * total * total))) / denom;
  return Math.max(0, center - margin);
}

// 在历史数据上模拟过去 N 个交易日的"滚动预测"
export function selfBacktest(
  bars: DailyBar[],
  weights: WeightCombo = DEFAULT_WEIGHTS,
  sampleDays: number = 250,
  horizons: number[] = [1, 5, 20]
): BacktestReport {
  const n = bars.length;
  if (n < 200) {
    return {
      totalSamples: 0,
      upHit: 0, upMiss: 0, downHit: 0, downMiss: 0, flatCount: 0,
      directionAccuracy: 0,
      meanError: 0,
      winRate: 0,
      wilsonLower: 0,
      horizons: horizons.map(d => ({ days: d, accuracy: 0, sampleSize: 0 })),
    };
  }

  const start = Math.max(200, n - sampleDays);
  let upHit = 0, upMiss = 0, downHit = 0, downMiss = 0, flatCount = 0;
  let returnSum = 0;
  let positiveReturn = 0;
  const dirErrors: number[] = [];

  // 默认评估5日方向
  const primaryHorizon = 5;

  for (let i = start; i < n - primaryHorizon; i++) {
    const window = bars.slice(0, i + 1);
    const factors = calcFactors(window);
    if (!factors) continue;
    const score = applyWeights(factors, weights);
    const predDir = score > 55 ? 1 : score < 45 ? -1 : 0;

    const futureReturn = (bars[i + primaryHorizon].close - bars[i].close) / bars[i].close;
    const actualDir: 1 | -1 | 0 = futureReturn > 0.005 ? 1 : futureReturn < -0.005 ? -1 : 0;
    returnSum += futureReturn;
    if (futureReturn > 0) positiveReturn++;

    if (predDir === 0) {
      flatCount++;
    } else if (predDir === 1) {
      if (actualDir === 1) upHit++;
      else if (actualDir === -1) upMiss++;
    } else {
      if (actualDir === -1) downHit++;
      else if (actualDir === 1) downMiss++;
    }
    dirErrors.push(predDir * actualDir);
  }

  const totalJudged = upHit + upMiss + downHit + downMiss;
  const directionAccuracy = totalJudged > 0 ? (upHit + downHit) / totalJudged : 0;
  const wilsonLower = wilsonLowerBound(upHit + downHit, totalJudged);
  const winRate = (upHit + upMiss + downHit + downMiss) > 0
    ? positiveReturn / (upHit + upMiss + downHit + downMiss)
    : 0;
  const meanError = dirErrors.length > 0
    ? dirErrors.reduce((s, v) => s + v, 0) / dirErrors.length
    : 0;

  // 多周期对比
  const horizonResults = horizons.map(days => {
    let correct = 0, total = 0;
    for (let i = start; i < n - days; i++) {
      const window = bars.slice(0, i + 1);
      const factors = calcFactors(window);
      if (!factors) continue;
      const score = applyWeights(factors, weights);
      const predDir = score > 55 ? 1 : score < 45 ? -1 : 0;
      if (predDir === 0) continue;
      const futureReturn = (bars[i + days].close - bars[i].close) / bars[i].close;
      const actualDir = futureReturn > 0.005 ? 1 : futureReturn < -0.005 ? -1 : 0;
      if (actualDir === 0) continue;
      if (predDir === actualDir) correct++;
      total++;
    }
    return { days, accuracy: total > 0 ? correct / total : 0, sampleSize: total };
  });

  return {
    totalSamples: upHit + upMiss + downHit + downMiss + flatCount,
    upHit, upMiss, downHit, downMiss, flatCount,
    directionAccuracy,
    meanError,
    winRate,
    wilsonLower,
    horizons: horizonResults,
  };
}
