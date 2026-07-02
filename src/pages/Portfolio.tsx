import { useState, useEffect, useCallback } from 'react';
import { useHoldings } from '@/hooks/useHoldings';
import { useStockStore } from '@/store/useStockStore';
import { Plus, Trash2, Loader2, Briefcase, TrendingUp, TrendingDown, Target, ShieldAlert } from 'lucide-react';
import type { Holding } from '@/hooks/useHoldings';
import { fetchKline } from '@/utils/api';
import { calcAllIndicators } from '@/utils/indicators';
import { predictWeek } from '@/utils/weekPredictor';
import type { WeekPrediction } from '@/utils/types';

// 单个持仓的实时分析数据
interface HoldingAnalysis {
  currentPrice: number;
  prediction: WeekPrediction | null;
  loading: boolean;
}

export default function Portfolio({ userId }: { userId: string }) {
  const { holdings, loading, addHolding, removeHolding } = useHoldings(userId);
  const { selectStock } = useStockStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', shares: '', costPrice: '', buyDate: '' });
  // 收集各持仓盈亏用于汇总
  const [profitMap, setProfitMap] = useState<Record<string, number>>({});

  const handleProfitUpdate = useCallback((id: string, profit: number) => {
    setProfitMap(prev => prev[id] === profit ? prev : { ...prev, [id]: profit });
  }, []);

  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.costPrice, 0);
  const totalProfit = holdings.reduce((sum, h) => sum + (profitMap[h.id] || 0), 0);
  const totalValue = totalCost + totalProfit;
  const totalProfitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  const hasData = Object.keys(profitMap).length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.shares || !form.costPrice) return;
    await addHolding({
      code: form.code,
      name: form.name,
      shares: parseInt(form.shares),
      costPrice: parseFloat(form.costPrice),
      buyDate: form.buyDate || new Date().toISOString().slice(0, 10),
    });
    setForm({ code: '', name: '', shares: '', costPrice: '', buyDate: '' });
    setShowForm(false);
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Briefcase size={20} className="text-[#ffd700]" />
            我的持仓
          </h2>
          <p className="text-[#4a6fa5] text-xs mt-0.5">
            共 {holdings.length} 只 · 总成本 <span className="text-[#ffd700] font-mono">¥{totalCost.toFixed(2)}</span>
            {hasData && (
              <>
                {' · 总市值 '}
                <span className="text-white/80 font-mono">¥{totalValue.toFixed(2)}</span>
                {' · 盈亏 '}
                <span className="font-mono font-bold" style={{ color: totalProfit >= 0 ? '#ff4757' : '#00ff88' }}>
                  {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} ({totalProfitPercent >= 0 ? '+' : ''}{totalProfitPercent.toFixed(2)}%)
                </span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#00ff88] to-[#1e90ff] text-[#0a0e27] font-bold text-xs rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          添加持仓
        </button>
      </div>

      {/* 添加持仓表单 */}
      {showForm && (
        <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-4 animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[#4a6fa5] text-xs block mb-1">股票代码</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full bg-[#0a0e27] border border-[#1e3a5f]/50 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-[#00ff88]/50"
                  placeholder="600519"
                />
              </div>
              <div>
                <label className="text-[#4a6fa5] text-xs block mb-1">股票名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#0a0e27] border border-[#1e3a5f]/50 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#00ff88]/50"
                  placeholder="贵州茅台"
                />
              </div>
              <div>
                <label className="text-[#4a6fa5] text-xs block mb-1">持有股数</label>
                <input
                  type="number"
                  value={form.shares}
                  onChange={(e) => setForm({ ...form, shares: e.target.value })}
                  className="w-full bg-[#0a0e27] border border-[#1e3a5f]/50 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-[#00ff88]/50"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="text-[#4a6fa5] text-xs block mb-1">成本价</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  className="w-full bg-[#0a0e27] border border-[#1e3a5f]/50 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-[#00ff88]/50"
                  placeholder="1185.50"
                />
              </div>
            </div>
            <div>
              <label className="text-[#4a6fa5] text-xs block mb-1">买入日期</label>
              <input
                type="date"
                value={form.buyDate}
                onChange={(e) => setForm({ ...form, buyDate: e.target.value })}
                className="w-full bg-[#0a0e27] border border-[#1e3a5f]/50 rounded-lg px-3 py-2 text-white text-sm font-mono outline-none focus:border-[#00ff88]/50"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-[#00ff88] text-[#0a0e27] font-bold py-2 rounded-lg text-sm hover:opacity-90 transition-opacity">
                确认添加
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-[#1e3a5f]/30 text-[#4a6fa5] rounded-lg text-sm hover:bg-[#1e3a5f]/50 transition-colors">
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 持仓列表 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="text-[#00ff88] animate-spin" />
        </div>
      ) : holdings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Briefcase size={40} className="text-[#1e3a5f] mx-auto" />
            <p className="text-[#4a6fa5] text-sm">暂无持仓</p>
            <p className="text-[#4a6fa5] text-xs">点击上方"添加持仓"开始记录</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {holdings.map((h) => (
            <HoldingCard key={h.id} holding={h} onRemove={removeHolding} onClick={() => selectStock(h.code, h.name)} onProfitUpdate={handleProfitUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

// 生成买卖建议
function getAdvice(currentPrice: number, prediction: WeekPrediction | null): {
  action: 'buy' | 'sell' | 'stoploss' | 'hold';
  text: string;
  color: string;
} {
  if (!prediction) return { action: 'hold', text: '数据加载中', color: '#4a6fa5' };

  const { buyPrice, sellPrice, stopLossPrice } = prediction;

  if (currentPrice <= stopLossPrice) {
    return { action: 'stoploss', text: '触及止损，建议减仓', color: '#ff4757' };
  }
  if (currentPrice <= buyPrice) {
    return { action: 'buy', text: '接近买入位，可加仓', color: '#00ff88' };
  }
  if (currentPrice >= sellPrice) {
    return { action: 'sell', text: '到达目标价，可卖出', color: '#ffd700' };
  }
  return { action: 'hold', text: '持有观望', color: '#4a6fa5' };
}

function HoldingCard({ holding, onRemove, onClick, onProfitUpdate }: { holding: Holding; onRemove: (id: string) => void; onClick: () => void; onProfitUpdate: (id: string, profit: number) => void }) {
  const [analysis, setAnalysis] = useState<HoldingAnalysis>({ currentPrice: 0, prediction: null, loading: true });

  const loadAnalysis = useCallback(async () => {
    try {
      const klineData = await fetchKline(holding.code, 730);
      if (klineData.bars.length === 0) {
        setAnalysis({ currentPrice: holding.costPrice, prediction: null, loading: false });
        return;
      }
      const bars = klineData.bars;
      const currentPrice = bars[bars.length - 1].close;
      const indicators = calcAllIndicators(bars);
      const prediction = predictWeek(bars, indicators, 50, '温和', 'short');
      setAnalysis({ currentPrice, prediction, loading: false });
    } catch {
      setAnalysis({ currentPrice: holding.costPrice, prediction: null, loading: false });
    }
  }, [holding.code, holding.costPrice]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  const { currentPrice, prediction, loading: analysisLoading } = analysis;
  const profit = (currentPrice - holding.costPrice) * holding.shares;
  const profitPercent = holding.costPrice > 0 ? ((currentPrice - holding.costPrice) / holding.costPrice) * 100 : 0;
  const isProfit = profit >= 0;

  // 上报盈亏给父组件汇总
  useEffect(() => {
    if (!analysisLoading && currentPrice > 0) {
      onProfitUpdate(holding.id, profit);
    }
  }, [analysisLoading, currentPrice, profit, holding.id, onProfitUpdate]);

  // A股惯例: 红涨绿跌
  const profitColor = isProfit ? '#ff4757' : '#00ff88';
  const advice = getAdvice(currentPrice, prediction);

  return (
    <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-xl p-4 hover:border-[#00ff88]/20 transition-all group">
      <div className="flex items-start justify-between">
        <button onClick={onClick} className="text-left flex-1 min-w-0">
          {/* 代码 + 名称 + 当前价 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-white font-bold font-mono text-sm">{holding.code}</span>
            <span className="text-[#4a6fa5] text-sm truncate">{holding.name}</span>
            {!analysisLoading && currentPrice > 0 && (
              <span className="text-white/90 font-mono text-sm ml-auto">现价 {currentPrice.toFixed(2)}</span>
            )}
          </div>

          {/* 盈亏核心数据 */}
          {!analysisLoading && currentPrice > 0 ? (
            <div className="grid grid-cols-2 gap-3 mb-2">
              {/* 左:盈亏金额 */}
              <div className="bg-[#0a0e27]/60 rounded-lg p-2">
                <span className="text-[#4a6fa5] text-xs block">浮动盈亏</span>
                <div className="flex items-center gap-1">
                  {isProfit ? <TrendingUp size={14} className={profitColor} /> : <TrendingDown size={14} className={profitColor} />}
                  <span className="font-mono font-bold text-sm" style={{ color: profitColor }}>
                    {isProfit ? '+' : ''}{profit.toFixed(2)}
                  </span>
                </div>
                <span className="font-mono text-xs" style={{ color: profitColor }}>
                  {isProfit ? '+' : ''}{profitPercent.toFixed(2)}%
                </span>
              </div>
              {/* 右:当前市值 */}
              <div className="bg-[#0a0e27]/60 rounded-lg p-2">
                <span className="text-[#4a6fa5] text-xs block">当前市值</span>
                <span className="text-white/90 font-mono font-bold text-sm">
                  ¥{(currentPrice * holding.shares).toFixed(2)}
                </span>
                <span className="text-[#4a6fa5] text-xs block">
                  成本 ¥{(holding.costPrice * holding.shares).toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-xs mb-2">
              <div>
                <span className="text-[#4a6fa5] block">持有股数</span>
                <span className="text-white/80 font-mono">{holding.shares}</span>
              </div>
              <div>
                <span className="text-[#4a6fa5] block">成本价</span>
                <span className="text-[#ffd700] font-mono">{holding.costPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[#4a6fa5] block">总成本</span>
                <span className="text-white/80 font-mono">¥{(holding.shares * holding.costPrice).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* 持仓基础信息 */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[#4a6fa5] block">持有</span>
              <span className="text-white/80 font-mono">{holding.shares}股</span>
            </div>
            <div>
              <span className="text-[#4a6fa5] block">成本价</span>
              <span className="text-[#ffd700] font-mono">{holding.costPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[#4a6fa5] block">买入日</span>
              <span className="text-white/60 font-mono">{holding.buyDate}</span>
            </div>
          </div>

          {/* 买卖建议 */}
          {!analysisLoading && prediction && (
            <div className="mt-2 pt-2 border-t border-[#1e3a5f]/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target size={12} style={{ color: advice.color }} />
                <span className="text-xs font-bold" style={{ color: advice.color }}>{advice.text}</span>
                <span className="text-[#4a6fa5] text-xs ml-auto">预期收益 +{prediction.expectedReturn.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-[#00ff88]">买入位 {prediction.buyPrice.toFixed(2)}</span>
                <span className="text-[#ffd700]">卖出位 {prediction.sellPrice.toFixed(2)}</span>
                <span className="text-[#ff4757] flex items-center gap-0.5">
                  <ShieldAlert size={10} />
                  止损 {prediction.stopLossPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(holding.id); }}
          className="text-[#4a6fa5] hover:text-[#ff4757] transition-colors p-1 opacity-0 group-hover:opacity-100 shrink-0"
          title="删除持仓"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
