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
  horizon: PredictionHorizon;
  days: number;              // 5 或 20
  currentPrice: number;
  // 方向概率
  upProbability: number;
  downProbability: number;
  flatProbability: number;
  // 收益分布
  expectedReturn: number;
  ci80Lower: number;
  ci80Upper: number;
  ci95Lower: number;
  ci95Upper: number;
  // 可信度
  score: number;
  matchSampleSize: number;
  weights: { technical: number; momentum: number; trend: number; pattern: number };
  weightAccuracy: number;
  backtest: {
    totalSamples: number;
    upHit: number; upMiss: number; downHit: number; downMiss: number; flatCount: number;
    directionAccuracy: number;
    meanError: number;
    winRate: number;
    wilsonLower: number;
    horizons: { days: number; accuracy: number; sampleSize: number }[];
  };
  // 业务字段
  buyPrice: number;
  sellPrice: number;
  stopLossPrice: number;
  holdDays: number;
  expectedReturnDisplay: number;
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  marketHeat: number;
  marketLabel: string;
  quantWeight: number;
  method: string;
  // 兼容旧字段
  dates: string[];
  bars: PredictedBar[];
  trendScore: number;
  volatility: number;
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
