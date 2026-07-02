import StockSearch from '@/components/StockSearch';
import KlineChart from '@/components/KlineChart';
import WeekPredictionPanel from '@/components/WeekPredictionPanel';
import { useStockStore } from '@/store/useStockStore';
import { STOCK_LIST, FUND_LIST } from '@/utils/stockData';
import type { InstrumentType } from '@/utils/types';
import { Loader2, Wifi, WifiOff } from 'lucide-react';

const typeLabels: Record<string, { label: string; color: string }> = {
  stock: { label: '股票', color: 'bg-[#1e90ff]/20 text-[#1e90ff]' },
  etf: { label: 'ETF', color: 'bg-[#00ff88]/20 text-[#00ff88]' },
  lof: { label: 'LOF', color: 'bg-[#ffd700]/20 text-[#ffd700]' },
  qdii: { label: 'QDII', color: 'bg-[#a855f7]/20 text-[#a855f7]' },
  fund: { label: '基金', color: 'bg-[#ff6b9d]/20 text-[#ff6b9d]' },
};

export default function Analysis() {
  const { stockCode, stockName, stockType, bars, loading, error, useRealData, setUseRealData, weekPrediction, horizon, setHorizon } = useStockStore();

  const latestDate = bars.length > 0 ? bars[bars.length - 1].date : '';
  const typeInfo = typeLabels[stockType] || typeLabels.stock;

  return (
    <div className="h-full flex flex-col">
      {/* 顶部搜索栏 + 数据源切换 */}
      <div className="px-3 md:px-4 pt-3 md:pt-4 pb-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <StockSearch />
        </div>
        <button
          onClick={() => setUseRealData(!useRealData)}
          className={`flex items-center gap-1.5 px-2.5 md:px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-300 shrink-0 ${
            useRealData
              ? 'bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]'
              : 'bg-[#ff4757]/10 border-[#ff4757]/30 text-[#ff4757]'
          }`}
          title={useRealData ? '当前：真实数据' : '当前：模拟数据'}
        >
          {useRealData ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="hidden sm:inline">{useRealData ? '真实' : '模拟'}</span>
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-3 md:mx-4 mb-2 px-3 py-2 bg-[#ffd700]/10 border border-[#ffd700]/30 rounded-lg text-[#ffd700] text-xs">
          {error}
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-[#00ff88]">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        </div>
      )}

      {!loading && bars.length === 0 ? (
        /* 空状态 */
        <div className="flex-1 overflow-y-auto px-3 md:px-4">
          <div className="text-center space-y-5 py-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00ff88]/20 to-[#1e90ff]/20 border border-[#1e3a5f]/30 flex items-center justify-center mx-auto">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a6fa5" strokeWidth="1.5">
                <path d="M3 3v18h18" />
                <path d="M7 16l4-8 4 4 5-8" stroke="#00ff88" />
              </svg>
            </div>
            <div>
              <h2 className="text-white/80 text-base md:text-lg font-semibold mb-1">开始分析行情</h2>
              <p className="text-[#4a6fa5] text-xs md:text-sm">
                输入股票或基金代码，获取行情数据与预测
              </p>
            </div>
            {/* 热门股票 */}
            <div>
              <p className="text-[#4a6fa5] text-xs mb-2">热门股票</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {STOCK_LIST.slice(0, 6).map((s) => (
                  <button
                    key={s.code}
                    onClick={() => useStockStore.getState().selectStock(s.code, s.name, 'stock')}
                    className="px-3 py-1.5 bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-lg text-[#4a6fa5] text-xs hover:text-[#1e90ff] hover:border-[#1e90ff]/30 transition-all font-mono"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            {/* 热门基金 */}
            <div className="pb-4">
              <p className="text-[#4a6fa5] text-xs mb-2">热门基金</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {FUND_LIST.slice(0, 8).map((s) => (
                  <button
                    key={s.code}
                    onClick={() => useStockStore.getState().selectStock(s.code, s.name, (s.type as InstrumentType) || 'etf')}
                    className="px-3 py-1.5 bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-lg text-[#4a6fa5] text-xs hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all font-mono"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : !loading ? (
        /* 主内容区 - 移动端垂直滚动，桌面端左右分栏 */
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 px-3 md:px-4 pb-3 md:pb-4 overflow-y-auto lg:overflow-hidden">
          {/* K线图区域 */}
          <div className="lg:flex-1 lg:min-w-0 flex flex-col">
            <div className="bg-[#0d1333]/40 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-2 md:p-3 flex flex-col h-[320px] md:h-[380px] lg:h-full">
              {/* 标题栏 */}
              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  <span className="text-white font-bold font-mono text-sm md:text-base">{stockCode}</span>
                  <span className="text-[#4a6fa5] text-xs md:text-sm">{stockName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeInfo.color}`}>{typeInfo.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${useRealData ? 'bg-[#00ff88]/10 text-[#00ff88]' : 'bg-[#ffd700]/10 text-[#ffd700]'}`}>
                    {useRealData ? '真实' : '模拟'}
                  </span>
                </div>
                <span className="text-[#4a6fa5] text-[10px] md:text-xs">截至 {latestDate}</span>
              </div>
              {/* K线图 */}
              <div className="flex-1 min-h-0">
                <KlineChart />
              </div>
            </div>
          </div>

          {/* 预测面板 */}
          <div className="lg:w-80 lg:shrink-0 lg:overflow-y-auto">
            <div className="bg-[#0d1333]/40 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-2 md:p-3">
              <WeekPredictionPanel
                prediction={weekPrediction}
                historicalBars={bars}
                latestDate={latestDate}
                horizon={horizon}
                onHorizonChange={setHorizon}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
