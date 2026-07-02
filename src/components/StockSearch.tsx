import { useStockStore } from '@/store/useStockStore';
import { Search } from 'lucide-react';
import type { InstrumentType } from '@/utils/types';

const typeLabels: Record<string, { label: string; color: string }> = {
  stock: { label: '股票', color: 'bg-[#1e90ff]/20 text-[#1e90ff]' },
  etf: { label: 'ETF', color: 'bg-[#00ff88]/20 text-[#00ff88]' },
  lof: { label: 'LOF', color: 'bg-[#ffd700]/20 text-[#ffd700]' },
  qdii: { label: 'QDII', color: 'bg-[#a855f7]/20 text-[#a855f7]' },
  fund: { label: '基金', color: 'bg-[#ff6b9d]/20 text-[#ff6b9d]' },
};

export default function StockSearch() {
  const { searchQuery, searchResults, setSearchQuery, selectStock } = useStockStore();

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-[#0d1333]/80 backdrop-blur-xl border border-[#1e3a5f]/50 rounded-xl px-4 py-2.5 focus-within:border-[#00ff88]/50 focus-within:shadow-[0_0_20px_rgba(0,255,136,0.15)] transition-all duration-300">
        <Search size={18} className="text-[#4a6fa5] shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="输入股票/基金代码或名称，如 600519、510300"
          className="bg-transparent outline-none text-white/90 placeholder:text-[#4a6fa5] text-sm w-full font-mono"
        />
      </div>
      {searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d1333]/95 backdrop-blur-xl border border-[#1e3a5f]/50 rounded-xl overflow-hidden z-50 shadow-2xl">
          {searchResults.map((s) => {
            const t = typeLabels[s.type || 'stock'] || typeLabels.stock;
            return (
              <button
                key={s.code}
                onClick={() => selectStock(s.code, s.name, (s.type as InstrumentType) || 'stock')}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#1e3a5f]/30 transition-colors text-left group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white/80 font-mono text-sm group-hover:text-[#00ff88] transition-colors">{s.code}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.color}`}>{t.label}</span>
                </div>
                <span className="text-white/60 text-sm">{s.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
