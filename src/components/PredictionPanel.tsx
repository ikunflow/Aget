import { useStockStore } from '@/store/useStockStore';
import { TrendingUp, TrendingDown, Minus, Shield, Target } from 'lucide-react';

export default function PredictionPanel() {
  const { prediction, bars } = useStockStore();

  if (!prediction || bars.length === 0) {
    return (
      <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-6">
        <p className="text-[#4a6fa5] text-sm text-center">选择股票后查看预测信号</p>
      </div>
    );
  }

  const signalConfig = {
    bullish: {
      label: '看涨',
      icon: TrendingUp,
      color: '#ff4757',
      bgGrad: 'from-[#ff4757]/10 to-[#ff4757]/5',
      borderColor: 'border-[#ff4757]/30',
      glow: 'shadow-[0_0_30px_rgba(255,71,87,0.15)]',
    },
    bearish: {
      label: '看跌',
      icon: TrendingDown,
      color: '#00ff88',
      bgGrad: 'from-[#00ff88]/10 to-[#00ff88]/5',
      borderColor: 'border-[#00ff88]/30',
      glow: 'shadow-[0_0_30px_rgba(0,255,136,0.15)]',
    },
    neutral: {
      label: '震荡',
      icon: Minus,
      color: '#ffd700',
      bgGrad: 'from-[#ffd700]/10 to-[#ffd700]/5',
      borderColor: 'border-[#ffd700]/30',
      glow: 'shadow-[0_0_30px_rgba(255,215,0,0.15)]',
    },
  };

  const cfg = signalConfig[prediction.signal];
  const Icon = cfg.icon;

  // 置信度环形进度
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (prediction.confidence / 100) * circumference;

  return (
    <div className={`bg-gradient-to-br ${cfg.bgGrad} backdrop-blur-xl border ${cfg.borderColor} rounded-2xl p-5 ${cfg.glow} transition-all duration-500`}>
      {/* 信号标题 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${cfg.color}20` }}>
          <Icon size={22} style={{ color: cfg.color }} />
        </div>
        <div>
          <h3 className="text-white/90 font-bold text-lg" style={{ color: cfg.color }}>{cfg.label}</h3>
          <p className="text-[#4a6fa5] text-xs">综合评分 {prediction.score}/100</p>
        </div>
      </div>

      {/* 置信度环 */}
      <div className="flex items-center justify-center mb-5">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" stroke="#1e3a5f" strokeWidth="6" fill="none" />
            <circle
              cx="50" cy="50" r="42"
              stroke={cfg.color}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-mono" style={{ color: cfg.color }}>{prediction.confidence}%</span>
            <span className="text-[#4a6fa5] text-xs">置信度</span>
          </div>
        </div>
      </div>

      {/* 关键价位 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Shield size={14} className="text-[#ff4757] shrink-0" />
          <span className="text-[#4a6fa5]">支撑位</span>
          <span className="ml-auto font-mono text-[#ff4757]">{prediction.supportPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Target size={14} className="text-[#00ff88] shrink-0" />
          <span className="text-[#4a6fa5]">压力位</span>
          <span className="ml-auto font-mono text-[#00ff88]">{prediction.resistancePrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Shield size={14} className="text-[#ffd700] shrink-0" />
          <span className="text-[#4a6fa5]">止损位</span>
          <span className="ml-auto font-mono text-[#ffd700]">{prediction.stopLossPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Target size={14} className="text-[#1e90ff] shrink-0" />
          <span className="text-[#4a6fa5]">止盈位</span>
          <span className="ml-auto font-mono text-[#1e90ff]">{prediction.takeProfitPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* 当前价格 */}
      {bars.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#1e3a5f]/30">
          <div className="flex justify-between items-center">
            <span className="text-[#4a6fa5] text-sm">最新价</span>
            <span className="font-mono text-white text-lg font-bold">{bars[bars.length - 1].close.toFixed(2)}</span>
          </div>
          {bars.length >= 2 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-[#4a6fa5] text-xs">涨跌幅</span>
              <span className={`font-mono text-sm font-bold ${bars[bars.length - 1].close >= bars[bars.length - 2].close ? 'text-[#ff4757]' : 'text-[#00ff88]'}`}>
                {((bars[bars.length - 1].close - bars[bars.length - 2].close) / bars[bars.length - 2].close * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
