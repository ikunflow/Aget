import StrategySelector from '@/components/StrategySelector';
import BacktestPanel from '@/components/BacktestPanel';
import TradeRecordTable from '@/components/TradeRecordTable';
import ActionAdvice from '@/components/ActionAdvice';
import { useStockStore } from '@/store/useStockStore';
import { STOCK_LIST } from '@/utils/stockData';

export default function Quant() {
  const { bars, stockCode, stockName } = useStockStore();

  if (bars.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-xl bg-[#0d1333]/60 border border-[#1e3a5f]/30 flex items-center justify-center mx-auto">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a6fa5" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h2 className="text-white/80 text-base md:text-lg font-semibold">请先选择股票</h2>
          <p className="text-[#4a6fa5] text-xs md:text-sm">前往行情分析页选择股票后开始量化模拟</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-sm">
            {STOCK_LIST.slice(0, 6).map((s) => (
              <button
                key={s.code}
                onClick={() => useStockStore.getState().selectStock(s.code)}
                className="px-3 py-1.5 bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-lg text-[#4a6fa5] text-xs hover:text-[#00ff88] hover:border-[#00ff88]/30 transition-all font-mono"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 p-3 md:p-4">
      {/* 标题 */}
      <div>
        <h2 className="text-white font-bold text-base md:text-lg flex items-center gap-2">
          <span className="font-mono">{stockCode}</span>
          <span className="text-[#4a6fa5] text-xs md:text-sm font-normal">{stockName}</span>
        </h2>
        <p className="text-[#4a6fa5] text-xs mt-0.5">量化策略模拟回测</p>
      </div>

      {/* 移动端垂直滚动，桌面端左右分栏 */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0 overflow-y-auto md:overflow-hidden">
        {/* 左侧：策略选择 */}
        <div className="md:w-56 md:shrink-0">
          <div className="bg-[#0d1333]/40 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-3 md:p-4">
            <StrategySelector />
          </div>
        </div>

        {/* 右侧：回测结果 */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 md:overflow-y-auto">
          <BacktestPanel />
          <TradeRecordTable />
          <ActionAdvice />
        </div>
      </div>
    </div>
  );
}
