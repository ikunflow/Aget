import { useStockStore } from '@/store/useStockStore';
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

export default function TradeRecordTable() {
  const { backtest, bars } = useStockStore();

  if (!backtest || bars.length === 0 || backtest.signals.length === 0) {
    return (
      <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-6">
        <p className="text-[#4a6fa5] text-sm text-center">暂无交易记录</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#0a0e27]">
            <tr className="border-b border-[#1e3a5f]/30">
              <th className="text-left px-4 py-2.5 text-[#4a6fa5] font-medium">日期</th>
              <th className="text-left px-4 py-2.5 text-[#4a6fa5] font-medium">操作</th>
              <th className="text-right px-4 py-2.5 text-[#4a6fa5] font-medium">价格</th>
              <th className="text-right px-4 py-2.5 text-[#4a6fa5] font-medium">盈亏%</th>
            </tr>
          </thead>
          <tbody>
            {backtest.signals.map((sig, idx) => (
              <tr key={idx} className={`border-b border-[#1e3a5f]/10 transition-colors ${
                sig.action === 'buy' ? 'hover:bg-[#ff4757]/5' : 'hover:bg-[#00ff88]/5'
              }`}>
                <td className="px-4 py-2 font-mono text-white/70">{sig.date}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    sig.action === 'buy' ? 'text-[#ff4757]' : 'text-[#00ff88]'
                  }`}>
                    {sig.action === 'buy' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                    {sig.action === 'buy' ? '买入' : '卖出'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono text-white/80">{sig.price.toFixed(2)}</td>
                <td className={`px-4 py-2 text-right font-mono font-semibold ${
                  sig.profit !== undefined
                    ? sig.profit >= 0 ? 'text-[#ff4757]' : 'text-[#00ff88]'
                    : 'text-[#4a6fa5]'
                }`}>
                  {sig.profit !== undefined ? `${sig.profit >= 0 ? '+' : ''}${sig.profit.toFixed(2)}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
