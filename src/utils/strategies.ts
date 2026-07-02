import type { DailyBar, IndicatorData, TradeSignal, BacktestResult, Strategy } from './types';

export const STRATEGIES: Strategy[] = [
  { id: 'ma_cross', name: '均线交叉', description: 'MA5上穿MA20买入，下穿卖出' },
  { id: 'macd_cross', name: 'MACD金叉', description: 'DIF上穿DEA买入，下穿卖出' },
  { id: 'boll_break', name: '布林带突破', description: '价格触及下轨买入，触及上轨卖出' },
  { id: 'kdj_trade', name: 'KDJ超买超卖', description: 'K<20买入，K>80卖出' },
  { id: 'multi_factor', name: '多因子组合', description: '综合以上信号加权评分' },
];

// 均线交叉策略
function maCrossStrategy(bars: DailyBar[], indicators: IndicatorData): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const { ma5, ma20 } = indicators;
  let holding = false;

  for (let i = 1; i < bars.length; i++) {
    if (isNaN(ma5[i]) || isNaN(ma20[i]) || isNaN(ma5[i - 1]) || isNaN(ma20[i - 1])) continue;

    if (!holding && ma5[i - 1] <= ma20[i - 1] && ma5[i] > ma20[i]) {
      signals.push({ date: bars[i].date, action: 'buy', price: bars[i].close });
      holding = true;
    } else if (holding && ma5[i - 1] >= ma20[i - 1] && ma5[i] < ma20[i]) {
      signals.push({ date: bars[i].date, action: 'sell', price: bars[i].close });
      holding = false;
    }
  }

  return signals;
}

// MACD金叉策略
function macdCrossStrategy(bars: DailyBar[], indicators: IndicatorData): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const { dif, dea } = indicators.macd;
  let holding = false;

  for (let i = 1; i < bars.length; i++) {
    if (isNaN(dif[i]) || isNaN(dea[i]) || isNaN(dif[i - 1]) || isNaN(dea[i - 1])) continue;

    if (!holding && dif[i - 1] <= dea[i - 1] && dif[i] > dea[i]) {
      signals.push({ date: bars[i].date, action: 'buy', price: bars[i].close });
      holding = true;
    } else if (holding && dif[i - 1] >= dea[i - 1] && dif[i] < dea[i]) {
      signals.push({ date: bars[i].date, action: 'sell', price: bars[i].close });
      holding = false;
    }
  }

  return signals;
}

// 布林带突破策略
function bollBreakStrategy(bars: DailyBar[], indicators: IndicatorData): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const { upper, lower } = indicators.boll;
  let holding = false;

  for (let i = 0; i < bars.length; i++) {
    if (isNaN(upper[i]) || isNaN(lower[i])) continue;

    if (!holding && bars[i].close <= lower[i]) {
      signals.push({ date: bars[i].date, action: 'buy', price: bars[i].close });
      holding = true;
    } else if (holding && bars[i].close >= upper[i]) {
      signals.push({ date: bars[i].date, action: 'sell', price: bars[i].close });
      holding = false;
    }
  }

  return signals;
}

// KDJ超买超卖策略
function kdjStrategy(bars: DailyBar[], indicators: IndicatorData): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const { k } = indicators.kdj;
  let holding = false;

  for (let i = 0; i < bars.length; i++) {
    if (isNaN(k[i])) continue;

    if (!holding && k[i] < 20) {
      signals.push({ date: bars[i].date, action: 'buy', price: bars[i].close });
      holding = true;
    } else if (holding && k[i] > 80) {
      signals.push({ date: bars[i].date, action: 'sell', price: bars[i].close });
      holding = false;
    }
  }

  return signals;
}

// 多因子组合策略
function multiFactorStrategy(bars: DailyBar[], indicators: IndicatorData): TradeSignal[] {
  const signals: TradeSignal[] = [];
  const { ma5, ma20, macd, kdj, boll, rsi } = indicators;
  let holding = false;

  for (let i = 1; i < bars.length; i++) {
    if (isNaN(ma5[i]) || isNaN(ma20[i]) || isNaN(macd.dif[i]) || isNaN(kdj.k[i]) || isNaN(rsi[i])) continue;

    let score = 50;

    // 均线信号
    if (ma5[i] > ma20[i]) score += 10;
    else score -= 10;

    // MACD信号
    if (macd.dif[i] > macd.dea[i]) score += 10;
    else score -= 10;

    // KDJ信号
    if (kdj.k[i] < 30) score += 10;
    else if (kdj.k[i] > 70) score -= 10;

    // RSI信号
    if (rsi[i] < 30) score += 10;
    else if (rsi[i] > 70) score -= 10;

    // 布林带信号
    if (!isNaN(boll.lower[i]) && bars[i].close <= boll.lower[i]) score += 10;
    if (!isNaN(boll.upper[i]) && bars[i].close >= boll.upper[i]) score -= 10;

    if (!holding && score >= 70) {
      signals.push({ date: bars[i].date, action: 'buy', price: bars[i].close });
      holding = true;
    } else if (holding && score <= 30) {
      signals.push({ date: bars[i].date, action: 'sell', price: bars[i].close });
      holding = false;
    }
  }

  return signals;
}

// 运行指定策略
export function runStrategy(
  strategyId: string,
  bars: DailyBar[],
  indicators: IndicatorData
): TradeSignal[] {
  switch (strategyId) {
    case 'ma_cross': return maCrossStrategy(bars, indicators);
    case 'macd_cross': return macdCrossStrategy(bars, indicators);
    case 'boll_break': return bollBreakStrategy(bars, indicators);
    case 'kdj_trade': return kdjStrategy(bars, indicators);
    case 'multi_factor': return multiFactorStrategy(bars, indicators);
    default: return [];
  }
}

// 回测策略
export function backtestStrategy(
  strategyId: string,
  bars: DailyBar[],
  indicators: IndicatorData
): BacktestResult {
  const rawSignals = runStrategy(strategyId, bars, indicators);

  // 配对买卖信号，计算盈亏
  const signals: TradeSignal[] = [];
  let buyPrice = 0;
  for (const sig of rawSignals) {
    if (sig.action === 'buy') {
      buyPrice = sig.price;
      signals.push(sig);
    } else if (sig.action === 'sell' && buyPrice > 0) {
      const profit = Math.round((sig.price - buyPrice) / buyPrice * 10000) / 100;
      signals.push({ ...sig, profit });
      buyPrice = 0;
    }
  }

  // 计算收益曲线
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  let wins = 0;
  let totalTrades = 0;
  const profitCurve: { date: string; value: number }[] = [{ date: bars[0]?.date || '', value: 100 }];

  for (const sig of signals) {
    if (sig.action === 'sell' && sig.profit !== undefined) {
      totalTrades++;
      equity *= (1 + sig.profit / 100);
      if (sig.profit > 0) wins++;
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
      profitCurve.push({
        date: sig.date,
        value: Math.round(equity * 100 * 100) / 100,
      });
    }
  }

  // 年化收益
  const tradingDays = bars.length;
  const annualReturn = tradingDays > 0
    ? Math.round((Math.pow(equity, 240 / tradingDays) - 1) * 10000) / 100
    : 0;

  // 夏普比率（简化：假设无风险利率3%）
  const avgDailyReturn = totalTrades > 0 ? (equity - 1) / tradingDays : 0;
  const sharpeRatio = avgDailyReturn > 0
    ? Math.round(Math.sqrt(240) * avgDailyReturn / 0.02 * 100) / 100
    : 0;

  return {
    annualReturn,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpeRatio: Math.max(0, sharpeRatio),
    winRate: totalTrades > 0 ? Math.round(wins / totalTrades * 10000) / 100 : 0,
    totalTrades,
    profitCurve,
    signals,
  };
}
