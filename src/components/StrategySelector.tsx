import { useStockStore } from '@/store/useStockStore';
import { STRATEGIES } from '@/utils/strategies';
import { Zap } from 'lucide-react';

export default function StrategySelector() {
  const { activeStrategy, setActiveStrategy, bars } = useStockStore();

  if (bars.length === 0) {
    return (
      <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-6">
        <p className="text-[#4a6fa5] text-sm text-center">选择股票后查看策略</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-white/80 font-semibold text-sm flex items-center gap-2">
        <Zap size={16} className="text-[#ffd700]" />
        量化策略选择
      </h3>
      <div className="grid grid-cols-1 gap-2">
        {STRATEGIES.map((s) => {
          const isActive = s.id === activeStrategy;
          return (
            <button
              key={s.id}
              onClick={() => setActiveStrategy(s.id)}
              className={`text-left p-3 rounded-xl border transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-[#00ff88]/10 to-[#1e90ff]/10 border-[#00ff88]/50 shadow-[0_0_20px_rgba(0,255,136,0.1)]'
                  : 'bg-[#0d1333]/40 border-[#1e3a5f]/30 hover:border-[#1e3a5f]/60 hover:bg-[#0d1333]/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold text-sm ${isActive ? 'text-[#00ff88]' : 'text-white/80'}`}>{s.name}</span>
                {isActive && (
                  <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                )}
              </div>
              <p className="text-[#4a6fa5] text-xs mt-1">{s.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
