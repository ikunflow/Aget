import { useState } from 'react';
import { useHoldings } from '@/hooks/useHoldings';
import { useStockStore } from '@/store/useStockStore';
import { Plus, Trash2, Loader2, Briefcase, TrendingUp } from 'lucide-react';
import type { Holding } from '@/hooks/useHoldings';

export default function Portfolio({ userId }: { userId: string }) {
  const { holdings, loading, addHolding, removeHolding } = useHoldings(userId);
  const { selectStock } = useStockStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', shares: '', costPrice: '', buyDate: '' });

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

  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.costPrice, 0);

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
            共 {holdings.length} 只股票 · 总成本 <span className="text-[#ffd700] font-mono">¥{totalCost.toFixed(2)}</span>
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
            <HoldingCard key={h.id} holding={h} onRemove={removeHolding} onClick={() => selectStock(h.code, h.name)} />
          ))}
        </div>
      )}
    </div>
  );
}

function HoldingCard({ holding, onRemove, onClick }: { holding: Holding; onRemove: (id: string) => void; onClick: () => void }) {
  return (
    <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-xl p-4 hover:border-[#00ff88]/20 transition-all group">
      <div className="flex items-start justify-between">
        <button onClick={onClick} className="text-left flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-bold font-mono text-sm">{holding.code}</span>
            <span className="text-[#4a6fa5] text-sm">{holding.name}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
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
          <div className="text-xs text-[#4a6fa5] mt-1.5">买入日期: {holding.buyDate}</div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(holding.id); }}
          className="text-[#4a6fa5] hover:text-[#ff4757] transition-colors p-1 opacity-0 group-hover:opacity-100"
          title="删除持仓"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
