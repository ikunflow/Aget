import ReactECharts from 'echarts-for-react';
import { useStockStore } from '@/store/useStockStore';
import { TrendingUp, BarChart3, Activity } from 'lucide-react';

export default function BacktestPanel() {
  const { backtest, bars } = useStockStore();

  if (!backtest || bars.length === 0) {
    return (
      <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-6">
        <p className="text-[#4a6fa5] text-sm text-center">选择股票和策略后查看回测结果</p>
      </div>
    );
  }

  const stats = [
    { icon: TrendingUp, label: '年化收益', value: `${backtest.annualReturn.toFixed(2)}%`, color: backtest.annualReturn >= 0 ? '#ff4757' : '#00ff88' },
    { icon: BarChart3, label: '最大回撤', value: `${backtest.maxDrawdown.toFixed(2)}%`, color: '#00ff88' },
    { icon: Activity, label: '夏普比率', value: backtest.sharpeRatio.toFixed(2), color: '#ffd700' },
    { icon: Activity, label: '胜率', value: `${backtest.winRate.toFixed(1)}%`, color: '#1e90ff' },
    { icon: BarChart3, label: '交易次数', value: `${backtest.totalTrades}`, color: '#a855f7' },
  ];

  const hasData = backtest.profitCurve.length > 1;

  const chartOption = hasData
    ? {
        backgroundColor: 'transparent',
        animation: true,
        tooltip: {
          trigger: 'axis' as const,
          backgroundColor: '#0d1333ee',
          borderColor: '#1e3a5f',
          textStyle: { color: '#e0e0e0', fontSize: 12 },
          formatter: (params: any) => {
            const p = params[0];
            if (!p) return '';
            return `<div style="font-family:monospace">${p.axisValue}<br/><span style="color:#ff4757">净值: ${p.value}</span></div>`;
          },
        },
        grid: { left: 50, right: 20, top: 20, bottom: 30 },
        xAxis: {
          type: 'category' as const,
          data: backtest.profitCurve.map(p => p.date),
          axisLine: { lineStyle: { color: '#1e3a5f' } },
          axisLabel: { color: '#4a6fa5', fontSize: 9, formatter: (v: string) => v.slice(5) },
        },
        yAxis: {
          type: 'value' as const,
          scale: true,
          splitLine: { lineStyle: { color: '#1e3a5f20' } },
          axisLabel: { color: '#4a6fa5', fontSize: 10 },
        },
        series: [
          {
            type: 'line' as const,
            data: backtest.profitCurve.map(p => p.value),
            smooth: true,
            showSymbol: false,
            lineStyle: { color: '#ff4757', width: 2 },
            areaStyle: {
              color: {
                type: 'linear' as const,
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(255,71,87,0.2)' },
                  { offset: 1, color: 'rgba(255,71,87,0.02)' },
                ],
              },
            },
            markLine: backtest.totalTrades > 0 ? {
              symbol: 'none',
              lineStyle: { type: 'dashed' as const, color: '#4a6fa5', width: 1 },
              label: { color: '#4a6fa5', fontSize: 9 },
              data: [{ yAxis: 100, label: { formatter: '基准' } }],
            } : undefined,
          },
        ],
      }
    : {
        backgroundColor: 'transparent',
        title: {
          text: '该策略未产生交易信号',
          left: 'center',
          top: 'center',
          textStyle: { color: '#4a6fa5', fontSize: 14 },
        },
      };

  return (
    <div className="space-y-4">
      {/* 统计指标 */}
      <div className="grid grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-xl p-3 text-center">
            <s.icon size={16} className="mx-auto mb-1" style={{ color: s.color }} />
            <div className="font-mono text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[#4a6fa5] text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 收益曲线 */}
      <div className="bg-[#0d1333]/60 backdrop-blur-xl border border-[#1e3a5f]/30 rounded-2xl p-4">
        <h3 className="text-white/80 font-semibold text-sm mb-3">策略收益曲线</h3>
        <div style={{ height: 220 }}>
          <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
