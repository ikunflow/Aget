export type InstrumentType = 'stock' | 'etf' | 'lof' | 'qdii' | 'fund';

export interface Stock {
  code: string;
  name: string;
  industry: string;
  type?: InstrumentType;
}

export interface DailyBar {
  stockCode: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeSignal {
  date: string;
  action: 'buy' | 'sell';
  price: number;
  profit?: number;
}

export interface PredictionResult {
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  supportPrice: number;
  resistancePrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  score: number;
}

export type PredictionHorizon = 'short' | 'long';

export interface WeekPrediction {
  horizon: PredictionHorizon;  // 短期/长期
  dates: string[];           // 未来交易日日期
  bars: PredictedBar[];      // 预测K线
  trendScore: number;        // 趋势评分 0-100
  volatility: number;        // 预测波动率
  quantWeight: number;       // 量化规律权重
  marketHeat: number;        // 大盘热度
  marketLabel: string;       // 大盘热度标签
  summary: string;           // 预测摘要
  buyPrice: number;          // 建议买入价位
  sellPrice: number;         // 建议卖出价位
  stopLossPrice: number;     // 止损价位
  holdDays: number;          // 建议持仓天数
  expectedReturn: number;    // 预期收益率%
  riskLevel: 'low' | 'medium' | 'high'; // 风险等级
}

export interface PredictedBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isPredicted: boolean;
}

export interface BacktestResult {
  annualReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  profitCurve: { date: string; value: number }[];
  signals: TradeSignal[];
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
}

export interface MACDResult {
  dif: number[];
  dea: number[];
  macd: number[];
}

export interface KDJResult {
  k: number[];
  d: number[];
  j: number[];
}

export interface BollingerResult {
  mid: number[];
  upper: number[];
  lower: number[];
}

export interface IndicatorData {
  ma5: number[];
  ma10: number[];
  ma20: number[];
  ma60: number[];
  macd: MACDResult;
  kdj: KDJResult;
  boll: BollingerResult;
  rsi: number[];
  volMa5: number[];
  volMa10: number[];
}
