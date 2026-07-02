import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStockStore } from '@/store/useStockStore';

export default function KlineChart() {
  const { bars, indicators } = useStockStore();

  const option = useMemo(() => {
    if (bars.length === 0 || !indicators) {
      return {
        backgroundColor: 'transparent',
        title: {
          text: '请输入股票代码查看K线图',
          left: 'center',
          top: 'center',
          textStyle: { color: '#4a6fa5', fontSize: 14 },
        },
      };
    }

    const dates = bars.map(b => b.date);
    const ohlc = bars.map(b => [b.open, b.close, b.low, b.high]);
    const volumes = bars.map((b) => ({
      value: b.volume,
      itemStyle: {
        color: b.close >= b.open ? '#ff475750' : '#00ff8850',
        borderColor: b.close >= b.open ? '#ff4757' : '#00ff88',
      },
    }));

    return {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: '#0d1333ee',
        borderColor: '#1e3a5f',
        textStyle: { color: '#e0e0e0', fontSize: 11 },
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { backgroundColor: '#1e3a5f' },
      },
      grid: [
        { left: 50, right: 15, top: 8, height: '52%' },
        { left: 50, right: 15, top: '65%', height: '10%' },
        { left: 50, right: 15, top: '80%', height: '12%' },
      ],
      xAxis: [
        { type: 'category', data: dates, gridIndex: 0, axisLine: { lineStyle: { color: '#1e3a5f' } }, axisLabel: { show: false }, axisTick: { show: false } },
        { type: 'category', data: dates, gridIndex: 1, axisLine: { lineStyle: { color: '#1e3a5f' } }, axisLabel: { show: false }, axisTick: { show: false } },
        { type: 'category', data: dates, gridIndex: 2, axisLine: { lineStyle: { color: '#1e3a5f' } }, axisLabel: { color: '#4a6fa5', fontSize: 9 } },
      ],
      yAxis: [
        { scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#1e3a5f20' } }, axisLine: { show: false }, axisLabel: { color: '#4a6fa5', fontSize: 9 } },
        { scale: true, gridIndex: 1, splitLine: { show: false }, axisLine: { show: false }, axisLabel: { show: false } },
        { scale: true, gridIndex: 2, splitLine: { lineStyle: { color: '#1e3a5f20' } }, axisLine: { show: false }, axisLabel: { color: '#4a6fa5', fontSize: 9 } },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1, 2], start: 60, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1, 2], bottom: 2, height: 12, borderColor: '#1e3a5f', backgroundColor: '#0a0e27', fillerColor: '#1e3a5f30', handleStyle: { color: '#00ff88' }, textStyle: { color: '#4a6fa5', fontSize: 9 } },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: ohlc,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: { color: '#ff4757', color0: '#00ff88', borderColor: '#ff4757', borderColor0: '#00ff88' },
        },
        { name: 'MA5', type: 'line', data: indicators.ma5, xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#ffd700' } },
        { name: 'MA10', type: 'line', data: indicators.ma10, xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#1e90ff' } },
        { name: 'MA20', type: 'line', data: indicators.ma20, xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#ff6b9d' } },
        { name: 'MA60', type: 'line', data: indicators.ma60, xAxisIndex: 0, yAxisIndex: 0, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#a855f7' } },
        {
          name: '布林上轨',
          type: 'line',
          data: indicators.boll.upper,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#4a6fa540', type: 'dashed' },
        },
        {
          name: '布林中轨',
          type: 'line',
          data: indicators.boll.mid,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#4a6fa540' },
        },
        {
          name: '布林下轨',
          type: 'line',
          data: indicators.boll.lower,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#4a6fa540', type: 'dashed' },
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumes,
          xAxisIndex: 1,
          yAxisIndex: 1,
        },
        {
          name: 'MACD',
          type: 'bar',
          data: indicators.macd.macd.map(v => ({
            value: v,
            itemStyle: { color: v >= 0 ? '#ff475780' : '#00ff8880' },
          })),
          xAxisIndex: 2,
          yAxisIndex: 2,
        },
        { name: 'DIF', type: 'line', data: indicators.macd.dif, xAxisIndex: 2, yAxisIndex: 2, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#ffd700' } },
        { name: 'DEA', type: 'line', data: indicators.macd.dea, xAxisIndex: 2, yAxisIndex: 2, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#1e90ff' } },
      ],
    };
  }, [bars, indicators]);

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
}
