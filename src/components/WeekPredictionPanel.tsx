import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { WeekPrediction, DailyBar, PredictionHorizon } from '@/utils/types';
import { TrendingUp, Target, Shield, Calendar, Coins, Zap } from 'lucide-react';

interface Props {
  prediction: WeekPrediction | null;
  historicalBars: DailyBar[];
  latestDate: string;
  horizon: PredictionHorizon;
  onHorizonChange: (h: PredictionHorizon) => void;
}

export default function WeekPredictionPanel({ prediction, historicalBars, latestDate, horizon, onHorizonChange }: Props) {
  if (!prediction || prediction.bars.length === 0) {
    return (
      <div className="space-y-3">
        <HorizonSwitch horizon={horizon} onHorizonChange={onHorizonChange} />
        <p className="text-[#4a6fa5] text-xs text-center py-4">数据不足，无法预测</p>
      </div>
    );
  }

  const chartOption = useMemo(() => {
    const histLen = horizon === 'short' ? 20 : 40;
    const recentBars = historicalBars.slice(-histLen);
    const allBars = [...recentBars, ...prediction.bars];
    const histEnd = recentBars.length;

    const dates = allBars.map(b => b.date);
    const opens = allBars.map(b => b.open);
    const closes = allBars.map(b => b.close);
    const lows = allBars.map(b => b.low);
    const highs = allBars.map(b => b.high);
    const klineData = allBars.map((b, i) => [opens[i], closes[i], lows[i], highs[i]]);

    const markLines = {
      symbol: 'none',
      lineStyle: { type: 'dashed' as const, width: 1 },
      label: { fontSize: 9, position: 'insideEndTop' as const },
      data: [
        { yAxis: prediction.buyPrice, lineStyle: { color: '#ff4757' }, label: { formatter: '买入', color: '#ff4757' } },
        { yAxis: prediction.sellPrice, lineStyle: { color: '#ffd700' }, label: { formatter: '卖出', color: '#ffd700' } },
        { yAxis: prediction.stopLossPrice, lineStyle: { color: '#00ff88' }, label: { formatter: '止损', color: '#00ff88' } },
      ],
    };

    const markArea = {
      silent: true,
      itemStyle: { color: 'rgba(0,255,136,0.05)', borderColor: 'rgba(0,255,136,0.2)', borderWidth: 1 },
      data: [[{ xAxis: dates[histEnd] }, { xAxis: dates[dates.length - 1] }]],
    };

    return {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(13,19,51,0.95)',
        borderColor: '#1e3a5f',
        textStyle: { color: '#e0e6f0', fontSize: 11 },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex;
          if (idx === undefined) return '';
          const bar = allBars[idx];
          if (!bar) return '';
          const isPred = idx >= histEnd;
          const color = closes[idx] >= opens[idx] ? '#ff4757' : '#00ff88';
          return `<div style="font-family:monospace"><div style="margin-bottom:4px">${bar.date} ${isPred ? '<span style="color:#ffd700">[预测]</span>' : ''}</div><div>开盘: ${opens[idx].toFixed(2)}</div><div>收盘: <span style="color:${color}">${closes[idx].toFixed(2)}</span></div><div>最高: ${highs[idx].toFixed(2)}</div><div>最低: ${lows[idx].toFixed(2)}</div></div>`;
        },
      },
      grid: { left: 48, right: 35, top: 15, bottom: 18 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        axisLabel: { color: '#4a6fa5', fontSize: 8, formatter: (v: string) => v.slice(5) },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        axisLabel: { color: '#4a6fa5', fontSize: 8 },
        splitLine: { lineStyle: { color: '#1e3a5f', opacity: 0.3 } },
      },
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: klineData,
          itemStyle: { color: '#ff4757', color0: '#00ff88', borderColor: '#ff4757', borderColor0: '#00ff88' },
          markLine: markLines,
          markArea,
        },
      ],
    };
  }, [prediction, historicalBars, horizon]);

  const combinedScore = Math.round(prediction.trendScore * 0.7 + prediction.marketHeat * 0.3);
  const lastClose = historicalBars.length > 0 ? historicalBars[historicalBars.length - 1].close : 0;
  const predLastClose = prediction.bars[prediction.bars.length - 1]?.close || 0;
  const weekReturn = lastClose > 0 ? ((predLastClose - lastClose) / lastClose * 100).toFixed(2) : '0.00';
  const isUp = predLastClose >= lastClose;

  const riskColor = prediction.riskLevel === 'low' ? '#00ff88' : prediction.riskLevel === 'medium' ? '#ffd700' : '#ff4757';
  const riskLabel = prediction.riskLevel === 'low' ? '低风险' : prediction.riskLevel === 'medium' ? '中风险' : '高风险';

  return (
    <div className="space-y-3">
      {/* 短期/长期切换 */}
      <HorizonSwitch horizon={horizon} onHorizonChange={onHorizonChange} />

      {/* 预测K线图 */}
      <div className="bg-[#0a0e27]/60 border border-[#1e3a5f]/30 rounded-xl p-1.5" style={{ height: 200 }}>
        <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
      </div>

      {/* 买卖价位卡片 - 核心信息 */}
      <div className="bg-gradient-to-br from-[#0d1333]/80 to-[#1a1e3a]/60 border border-[#ff4757]/20 rounded-xl p-2.5 md:p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Target size={13} className="text-[#ff4757]" />
          <span className="text-white/80 font-bold text-xs">交易计划</span>
          <span className="text-[#4a6fa5] text-[10px] ml-auto">截至 {latestDate}</span>
        </div>

        {/* 买入价 & 卖出价 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#ff4757]/5 border border-[#ff4757]/20 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-0.5">
              <Coins size={11} className="text-[#ff4757]" />
              <span className="text-[#4a6fa5] text-[10px]">买入价</span>
            </div>
            <div className="text-[#ff4757] font-bold font-mono text-base md:text-lg">{prediction.buyPrice.toFixed(2)}</div>
            <div className="text-[#4a6fa5] text-[10px]">
              距现价 {lastClose > 0 ? (((prediction.buyPrice - lastClose) / lastClose) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="bg-[#ffd700]/5 border border-[#ffd700]/20 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp size={11} className="text-[#ffd700]" />
              <span className="text-[#4a6fa5] text-[10px]">卖出价</span>
            </div>
            <div className="text-[#ffd700] font-bold font-mono text-base md:text-lg">{prediction.sellPrice.toFixed(2)}</div>
            <div className="text-[#4a6fa5] text-[10px]">
              距现价 {lastClose > 0 ? (((prediction.sellPrice - lastClose) / lastClose) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>

        {/* 止损 & 持仓天数 & 预期收益 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg p-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Shield size={10} className="text-[#00ff88]" />
              <span className="text-[#4a6fa5] text-[9px]">止损</span>
            </div>
            <div className="text-[#00ff88] font-bold font-mono text-xs md:text-sm">{prediction.stopLossPrice.toFixed(2)}</div>
          </div>
          <div className="bg-[#1e90ff]/5 border border-[#1e90ff]/20 rounded-lg p-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Calendar size={10} className="text-[#1e90ff]" />
              <span className="text-[#4a6fa5] text-[9px]">持仓</span>
            </div>
            <div className="text-[#1e90ff] font-bold font-mono text-xs md:text-sm">{prediction.holdDays}天</div>
          </div>
          <div className="bg-[#a855f7]/5 border border-[#a855f7]/20 rounded-lg p-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Zap size={10} className="text-[#a855f7]" />
              <span className="text-[#4a6fa5] text-[9px]">预期</span>
            </div>
            <div className={`font-bold font-mono text-xs md:text-sm ${prediction.expectedReturn > 0 ? 'text-[#ff4757]' : 'text-[#00ff88]'}`}>
              {prediction.expectedReturn > 0 ? '+' : ''}{prediction.expectedReturn}%
            </div>
          </div>
        </div>

        {/* 风险等级条 */}
        <div className="flex items-center gap-2">
          <span className="text-[#4a6fa5] text-[10px]">风险</span>
          <div className="flex-1 h-1.5 bg-[#1e3a5f]/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: prediction.riskLevel === 'low' ? '30%' : prediction.riskLevel === 'medium' ? '60%' : '90%', background: riskColor }}
            />
          </div>
          <span className="text-[10px] font-bold" style={{ color: riskColor }}>{riskLabel}</span>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-2 text-center">
          <span className="text-[#4a6fa5] text-[10px] block mb-0.5">综合评分</span>
          <div className={`text-base md:text-lg font-bold font-mono ${combinedScore > 55 ? 'text-[#ff4757]' : combinedScore < 45 ? 'text-[#00ff88]' : 'text-[#ffd700]'}`}>
            {combinedScore}
          </div>
        </div>
        <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-2 text-center">
          <span className="text-[#4a6fa5] text-[10px] block mb-0.5">预计涨跌</span>
          <div className={`text-base md:text-lg font-bold font-mono ${isUp ? 'text-[#ff4757]' : 'text-[#00ff88]'}`}>
            {isUp ? '+' : ''}{weekReturn}%
          </div>
        </div>
        <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-2 text-center">
          <span className="text-[#4a6fa5] text-[10px] block mb-0.5">大盘热度</span>
          <div className={`text-base md:text-lg font-bold font-mono ${
            prediction.marketHeat > 65 ? 'text-[#ff4757]' : prediction.marketHeat < 35 ? 'text-[#1e90ff]' : 'text-[#ffd700]'
          }`}>
            {prediction.marketHeat}
          </div>
        </div>
      </div>

      {/* 每日预测 - 仅短期显示 */}
      {horizon === 'short' && (
        <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-2.5">
          <div className="text-[#4a6fa5] text-xs mb-1.5">每日预测</div>
          <div className="space-y-1">
            {prediction.bars.map((bar, i) => {
              const dayChange = i === 0
                ? ((bar.close - lastClose) / lastClose * 100).toFixed(2)
                : ((bar.close - prediction.bars[i-1].close) / prediction.bars[i-1].close * 100).toFixed(2);
              const up = bar.close >= bar.open;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-[#4a6fa5] font-mono w-14">{bar.date.slice(5)}</span>
                  <span className={`font-mono ${up ? 'text-[#ff4757]' : 'text-[#00ff88]'}`}>{bar.close.toFixed(2)}</span>
                  <span className={`font-mono ${parseFloat(dayChange) >= 0 ? 'text-[#ff4757]' : 'text-[#00ff88]'}`}>
                    {parseFloat(dayChange) >= 0 ? '+' : ''}{dayChange}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 摘要 */}
      <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-2.5">
        <p className="text-[#4a6fa5] text-[11px] md:text-xs leading-relaxed">{prediction.summary}</p>
        <p className="text-[#4a6fa5]/50 text-[10px] mt-1.5">⚠ 预测仅供参考，不构成投资建议</p>
      </div>
    </div>
  );
}

function HorizonSwitch({ horizon, onHorizonChange }: { horizon: PredictionHorizon; onHorizonChange: (h: PredictionHorizon) => void }) {
  return (
    <div className="flex gap-1.5 bg-[#0a0e27]/60 border border-[#1e3a5f]/30 rounded-xl p-1">
      <button
        onClick={() => onHorizonChange('short')}
        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${
          horizon === 'short'
            ? 'bg-gradient-to-r from-[#00ff88] to-[#1e90ff] text-[#0a0e27]'
            : 'text-[#4a6fa5] hover:text-white/70'
        }`}
      >
        <Zap size={12} />
        短期 (5天)
      </button>
      <button
        onClick={() => onHorizonChange('long')}
        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${
          horizon === 'long'
            ? 'bg-gradient-to-r from-[#ffd700] to-[#ff6b9d] text-[#0a0e27]'
            : 'text-[#4a6fa5] hover:text-white/70'
        }`}
      >
        <Calendar size={12} />
        长期 (20天)
      </button>
    </div>
  );
}
