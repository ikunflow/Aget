import { create } from 'zustand';
import type { DailyBar, IndicatorData, PredictionResult, BacktestResult, WeekPrediction, InstrumentType, PredictionHorizon } from '@/utils/types';
import { generateStockData, searchStocks as searchLocal, ALL_LIST } from '@/utils/stockData';
import { calcAllIndicators } from '@/utils/indicators';
import { predict } from '@/utils/predictor';
import { predictWeek } from '@/utils/weekPredictor';
import { backtestStrategy } from '@/utils/strategies';
import { fetchKline, searchStocksAPI, fetchMarketHeat } from '@/utils/api';

interface StockState {
  stockCode: string;
  stockName: string;
  stockType: InstrumentType;
  bars: DailyBar[];
  indicators: IndicatorData | null;
  prediction: PredictionResult | null;
  weekPrediction: WeekPrediction | null;
  backtest: BacktestResult | null;
  activeStrategy: string;
  horizon: PredictionHorizon;
  searchQuery: string;
  searchResults: { code: string; name: string; type?: string }[];
  loading: boolean;
  error: string | null;
  useRealData: boolean;

  setStockCode: (code: string) => void;
  setSearchQuery: (query: string) => void;
  selectStock: (code: string, name?: string, type?: InstrumentType) => void;
  setActiveStrategy: (id: string) => void;
  setUseRealData: (v: boolean) => void;
  setHorizon: (h: PredictionHorizon) => void;
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;

export const useStockStore = create<StockState>((set, get) => ({
  stockCode: '',
  stockName: '',
  stockType: 'stock',
  bars: [],
  indicators: null,
  prediction: null,
  weekPrediction: null,
  backtest: null,
  activeStrategy: 'multi_factor',
  horizon: 'short',
  searchQuery: '',
  searchResults: [],
  loading: false,
  error: null,
  useRealData: true,

  setStockCode: (code: string) => set({ stockCode: code }),

  setUseRealData: (v: boolean) => set({ useRealData: v }),

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    if (!query) {
      set({ searchResults: [] });
      return;
    }

    const { useRealData } = get();

    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      if (useRealData) {
        try {
          const data = await searchStocksAPI(query);
          if (data.length > 0) {
            set({ searchResults: data });
            return;
          }
        } catch {
          // API失败时回退到本地搜索
        }
      }
      const results = searchLocal(query);
      set({ searchResults: results.map(s => ({ code: s.code, name: s.name, type: s.type })) });
    }, 300);
  },

  selectStock: async (code: string, name?: string, type?: InstrumentType) => {
    const { useRealData, activeStrategy, horizon } = get();
    set({ loading: true, error: null });

    try {
      let bars: DailyBar[];
      let stockName = name || '';
      let stockType: InstrumentType = type || 'stock';

      if (useRealData) {
        const data = await fetchKline(code, 730);
        if (data.bars.length > 0) {
          bars = data.bars;
          stockName = data.name || stockName;
          stockType = data.type || stockType;
        } else {
          throw new Error('无K线数据');
        }
      } else {
        const item = ALL_LIST.find(s => s.code === code);
        if (!item) throw new Error('代码不存在');
        bars = generateStockData(code);
        stockName = item.name;
        stockType = item.type || 'stock';
      }

      const indicators = calcAllIndicators(bars);
      const predictionResult = predict(bars, indicators);
      const backtest = backtestStrategy(activeStrategy, bars, indicators);

      let marketHeat = 50;
      let marketLabel = '温和';
      try {
        const heatData = await fetchMarketHeat();
        marketHeat = heatData.heat;
        marketLabel = heatData.label;
      } catch {}

      const weekPred = predictWeek(bars, indicators, marketHeat, marketLabel, horizon);

      set({
        stockCode: code,
        stockName,
        stockType,
        bars,
        indicators,
        prediction: predictionResult,
        weekPrediction: weekPred,
        horizon,
        backtest,
        searchQuery: `${code} ${stockName}`,
        searchResults: [],
        loading: false,
      });
    } catch (err) {
      console.warn('真实数据获取失败，回退到模拟数据:', err);
      const item = ALL_LIST.find(s => s.code === code);
      const stockName = name || item?.name || code;
      const stockType = type || item?.type || 'stock';
      const bars = item ? generateStockData(code) : [];
      if (bars.length > 0) {
        const indicators = calcAllIndicators(bars);
        const predictionResult = predict(bars, indicators);
        const backtest = backtestStrategy(activeStrategy, bars, indicators);
        const weekPred = predictWeek(bars, indicators, 50, '温和', horizon);
        set({
          stockCode: code,
          stockName,
          stockType,
          bars,
          indicators,
          prediction: predictionResult,
          weekPrediction: weekPred,
          horizon,
          backtest,
          searchQuery: `${code} ${stockName}`,
          searchResults: [],
          loading: false,
          error: '真实数据获取失败，已回退到模拟数据',
        });
      } else {
        set({
          loading: false,
          error: '无法获取该代码数据',
        });
      }
    }
  },

  setActiveStrategy: (id: string) => {
    const { bars, indicators } = get();
    if (!indicators || bars.length === 0) {
      set({ activeStrategy: id });
      return;
    }
    const backtest = backtestStrategy(id, bars, indicators);
    set({ activeStrategy: id, backtest });
  },

  setHorizon: (h: PredictionHorizon) => {
    const { bars, indicators, weekPrediction } = get();
    set({ horizon: h });
    if (!indicators || bars.length === 0 || !weekPrediction) return;
    const weekPred = predictWeek(bars, indicators, weekPrediction.marketHeat, weekPrediction.marketLabel, h);
    set({ weekPrediction: weekPred });
  },
}));
