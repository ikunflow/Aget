import { useStockStore } from '@/store/useStockStore';
import { runStrategy } from '@/utils/strategies';
import { TrendingUp, TrendingDown, Pause } from 'lucide-react';

export default function ActionAdvice() {
  const { bars, indicators, activeStrategy, prediction } = useStockStore();

  if (!prediction || bars.length === 0 || !indicators) {
    return null;
  }

  // 根据当前指标状态和策略判断建议
  const signals = runStrategy(activeStrategy, bars, indicators);
  const lastSignals = signals.slice(-3);
  const lastAction = lastSignals.length > 0 ? lastSignals[lastSignals.length - 1].action : null;

  let advice: 'buy' | 'sell' | 'hold';
  let reason = '';

  if (prediction.signal === 'bullish' && lastAction !== 'buy') {
    advice = 'buy';
    reason = '技术指标综合看涨，建议买入';
  } else if (prediction.signal === 'bearish' && lastAction !== 'sell') {
    advice = 'sell';
    reason = '技术指标综合看跌，建议卖出';
  } else if (prediction.signal === 'bullish' && lastAction === 'buy') {
    advice = 'hold';
    reason = '已持仓且趋势向上，继续持有';
  } else if (prediction.signal === 'bearish' && lastAction === 'sell') {
    advice = 'hold';
    reason = '趋势向下且已清仓，观望为主';
  } else {
    advice = 'hold';
    reason = '当前震荡区间，建议观望';
  }

  const adviceConfig = {
    buy: {
      label: '建议买入',
      icon: TrendingUp,
      color: '#ff4757',
      gradient: 'from-[#ff4757]/20 to-[#ff4757]/5',
      border: 'border-[#ff4757]/50',
      pulse: 'animate-pulse',
    },
    sell: {
      label: '建议卖出',
      icon: TrendingDown,
      color: '#00ff88',
      gradient: 'from-[#00ff88]/20 to-[#00ff88]/5',
      border: 'border-[#00ff88]/50',
      pulse: 'animate-pulse',
    },
    hold: {
      label: '建议持有',
      icon: Pause,
      color: '#ffd700',
      gradient: 'from-[#ffd700]/10 to-[#ffd700]/5',
      border: 'border-[#ffd700]/30',
      pulse: '',
    },
  };

  const cfg = adviceConfig[advice];
  const Icon = cfg.icon;

  return (
    <div className={`bg-gradient-to-r ${cfg.gradient} backdrop-blur-xl border ${cfg.border} rounded-2xl p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.pulse}`} style={{ backgroundColor: `${cfg.color}20` }}>
            <Icon size={24} style={{ color: cfg.color }} />
          </div>
          <div>
            <h3 className="font-bold text-lg" style={{ color: cfg.color }}>{cfg.label}</h3>
            <p className="text-[#4a6fa5] text-xs">{reason}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-white/80 text-sm">
            置信度 <span style={{ color: cfg.color }}>{prediction.confidence}%</span>
          </div>
          <div className="text-[#4a6fa5] text-xs mt-0.5">
            评分 {prediction.score}/100
          </div>
        </div>
      </div>
    </div>
  );
}
