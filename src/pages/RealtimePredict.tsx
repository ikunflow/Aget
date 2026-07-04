import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStockStore } from '@/store/useStockStore';
import { fetchKline, fetchMarketHeat } from '@/utils/api';
import { calcAllIndicators } from '@/utils/indicators';
import { predictHour, type HourPrediction } from '@/utils/hourPredictor';
import type { DailyBar } from '@/utils/types';
import { Search, Loader2, Clock, TrendingUp, TrendingDown, Activity, Zap, BarChart3, AlertCircle, CheckCircle2, Target, ShieldAlert } from 'lucide-react';

export default function RealtimePredict() {
  const { searchQuery, searchResults, setSearchQuery, selectStock, stockCode, stockName, bars, loading, useRealData } = useStockStore();
  const [hourPred, setHourPred] = useState<HourPrediction | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60); // 秒

  // 当选中股票时,执行小时级预测
  const runPrediction = useCallback(async (code: string) => {
    setPredicting(true);
    try {
      const klineData = await fetchKline(code, 250);
      if (klineData.bars.length < 20) return;
      const bars = klineData.bars;
      const indicators = calcAllIndicators(bars);
      const heat = await fetchMarketHeat().catch(() => ({ heat: 50, label: '温和' }));
      const pred = predictHour(bars, indicators, heat.heat);
      setHourPred(pred);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('小时预测失败:', e);
    } finally {
      setPredicting(false);
    }
  }, []);

  // 监听选中股票
  useEffect(() => {
    if (stockCode && stockCode.length === 6) {
      runPrediction(stockCode);
    }
  }, [stockCode, runPrediction]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || !stockCode) return;
    const timer = setInterval(() => runPrediction(stockCode), refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, stockCode, refreshInterval, runPrediction]);

  // K线图配置
  const chartOption = hourPred ? buildChartOption(hourPred) : null;

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">
      {/* 标题区 */}
      <div>
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Clock size={20} className="text-[#1e90ff]" />
          实时小时级预测
        </h2>
        <p className="text-[#4a6fa5] text-xs mt-0.5">
          基于技术指标(RSI/MACD/布林带)+ 短期动量 + 趋势 + 历史模式,预测未来1小时(12个5分钟点)走势
        </p>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a6fa5]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="输入股票/基金代码或名称(例:600519、513310)"
          className="w-full bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm outline-none focus:border-[#00ff88]/50"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-[#0d1333] border border-[#1e3a5f]/30 rounded-xl max-h-60 overflow-y-auto shadow-2xl">
            {searchResults.map((r) => (
              <button
                key={r.code}
                onClick={() => selectStock(r.code, r.name, r.type as any)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1e3a5f]/20 text-left"
              >
                <span className="text-white/90 font-mono text-sm">{r.code}</span>
                <span className="text-[#4a6fa5] text-sm flex-1 truncate">{r.name}</span>
                {r.type && <span className="text-[#ffd700] text-xs">{r.type.toUpperCase()}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 当前选中 + 刷新控制 */}
      {stockCode && (
        <div className="flex items-center justify-between bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold font-mono text-sm">{stockCode}</span>
              <span className="text-[#4a6fa5] text-sm">{stockName}</span>
            </div>
            {lastUpdate && (
              <p className="text-[#4a6fa5] text-xs mt-0.5">
                更新于 {lastUpdate.toLocaleTimeString('zh-CN')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[#4a6fa5] cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#00ff88]"
              />
              自动
            </label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
              disabled={!autoRefresh}
              className="bg-[#0a0e27] border border-[#1e3a5f]/50 rounded px-2 py-1 text-white text-xs font-mono disabled:opacity-40"
            >
              <option value={30}>30秒</option>
              <option value={60}>1分钟</option>
              <option value={300}>5分钟</option>
            </select>
            <button
              onClick={() => runPrediction(stockCode)}
              disabled={predicting}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1e90ff]/20 border border-[#1e90ff]/40 text-[#1e90ff] rounded-lg text-xs hover:bg-[#1e90ff]/30 disabled:opacity-50"
            >
              {predicting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              刷新
            </button>
          </div>
        </div>
      )}

      {/* 加载状态 */}
      {(predicting || (loading && !hourPred)) && (
        <div className="flex items-center justify-center py-12 gap-2 text-[#4a6fa5]">
          <Loader2 size={20} className="animate-spin text-[#00ff88]" />
          <span className="text-sm">正在分析...</span>
        </div>
      )}

      {/* 预测结果 */}
      {hourPred && stockCode && (
        <>
          {/* 评分 + 方向核心卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ScoreCard
              icon={<Activity size={16} />}
              label="综合评分"
              value={hourPred.score.toString()}
              hint={hourPred.score > 60 ? '偏多' : hourPred.score < 40 ? '偏空' : '震荡'}
              color={hourPred.score > 60 ? '#ff4757' : hourPred.score < 40 ? '#00ff88' : '#ffd700'}
            />
            <ScoreCard
              icon={hourPred.direction === 'up' ? <TrendingUp size={16} /> : hourPred.direction === 'down' ? <TrendingDown size={16} /> : <Activity size={16} />}
              label="1小时预期"
              value={`${hourPred.expectedChange >= 0 ? '+' : ''}${hourPred.expectedChange.toFixed(2)}%`}
              hint={hourPred.direction === 'up' ? '看涨' : hourPred.direction === 'down' ? '看跌' : '震荡'}
              color={hourPred.expectedChange > 0 ? '#ff4757' : hourPred.expectedChange < 0 ? '#00ff88' : '#4a6fa5'}
            />
            <ScoreCard
              icon={<BarChart3 size={16} />}
              label="置信度"
              value={`${(hourPred.confidence * 100).toFixed(0)}%`}
              hint={hourPred.confidence > 0.7 ? '高' : hourPred.confidence > 0.5 ? '中' : '低'}
              color="#1e90ff"
            />
            <ScoreCard
              icon={<Target size={16} />}
              label="目标价"
              value={hourPred.predictedClose.toFixed(2)}
              hint="1小时预测"
              color="#ffd700"
            />
          </div>

          {/* 预测K线图 */}
          <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white text-sm font-bold">未来1小时(5分钟K线)预测</h3>
              <span className="text-[#4a6fa5] text-xs">共 {hourPred.predictedBars.length} 个5分钟点</span>
            </div>
            <ReactECharts
              option={chartOption!}
              style={{ height: 320 }}
              notMerge={true}
              lazyUpdate={true}
              theme="dark"
            />
          </div>

          {/* 5维度评分 + 买卖建议 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 评分维度 */}
            <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
              <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-[#1e90ff]" />
                预测因子评分
              </h3>
              <div className="space-y-2">
                <FactorBar label="技术指标 (RSI/MACD/布林)" score={hourPred.factors.technical} weight="35%" />
                <FactorBar label="短期动量" score={hourPred.factors.momentum} weight="25%" />
                <FactorBar label="趋势强度 (MA20)" score={hourPred.factors.trend} weight="20%" />
                <FactorBar label="历史模式匹配" score={hourPred.factors.pattern} weight="20%" />
              </div>
            </div>

            {/* 操作建议 */}
            <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
              <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-1.5">
                {hourPred.direction === 'up' ? <TrendingUp size={14} className="text-[#ff4757]" /> : hourPred.direction === 'down' ? <TrendingDown size={14} className="text-[#00ff88]" /> : <Activity size={14} className="text-[#ffd700]" />}
                操作建议
              </h3>
              <AdviceBlock pred={hourPred} />
            </div>
          </div>

          {/* 预测方法说明 */}
          <div className="bg-[#0d1333]/40 border border-[#1e3a5f]/20 rounded-xl p-3 text-xs text-[#4a6fa5]">
            <p className="flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>
                <strong className="text-white/80">预测方法:</strong> {hourPred.method}。
                小时级预测基于日线数据推断,实际盘中走势受消息面、买卖盘、资金流等多重因素影响,本预测仅供参考,不构成投资建议。
              </span>
            </p>
          </div>
        </>
      )}

      {/* 空状态 */}
      {!stockCode && !predicting && (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3 max-w-sm">
            <Clock size={48} className="text-[#1e3a5f] mx-auto" />
            <h3 className="text-white/80 text-base font-bold">选择股票开始小时级预测</h3>
            <p className="text-[#4a6fa5] text-sm leading-relaxed">
              基于技术指标、动量、趋势和历史模式,预测未来1小时(12个5分钟点)的可能走势、关键支撑压力位和操作建议。
            </p>
            <p className="text-[#4a6fa5] text-xs">支持A股、ETF、LOF、QDII等场内基金</p>
          </div>
        </div>
      )}
    </div>
  );
}

// 评分卡
function ScoreCard({ icon, label, value, hint, color }: { icon: React.ReactNode; label: string; value: string; hint: string; color: string }) {
  return (
    <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[#4a6fa5] text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 font-mono font-bold text-lg" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color }}>{hint}</div>
    </div>
  );
}

// 因子进度条
function FactorBar({ label, score, weight }: { label: string; score: number; weight: string }) {
  const color = score > 60 ? '#ff4757' : score < 40 ? '#00ff88' : '#ffd700';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[#4a6fa5]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[#4a6fa5] text-[10px]">{weight}</span>
          <span className="font-mono font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#0a0e27] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

// 操作建议
function AdviceBlock({ pred }: { pred: HourPrediction }) {
  // 计算关键位
  const allHighs = pred.predictedBars.map(b => b.high);
  const allLows = pred.predictedBars.map(b => b.low);
  const resistance = Math.max(...allHighs);
  const support = Math.min(...allLows);
  const predictedClose = pred.predictedClose;

  if (pred.direction === 'up') {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="text-[#ff4757] mt-0.5 shrink-0" />
          <div>
            <div className="text-white/90 font-bold">短线偏多,可在回调时小仓位介入</div>
            <div className="text-[#4a6fa5] text-xs mt-0.5">建议快进快出,设置好止盈位</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e3a5f]/20">
          <div>
            <div className="text-[#4a6fa5] text-xs">短线压力</div>
            <div className="font-mono text-[#ff4757] font-bold">{resistance.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[#4a6fa5] text-xs">短线支撑</div>
            <div className="font-mono text-[#00ff88] font-bold">{support.toFixed(2)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (pred.direction === 'down') {
    return (
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <ShieldAlert size={14} className="text-[#00ff88] mt-0.5 shrink-0" />
          <div>
            <div className="text-white/90 font-bold">短线偏空,建议观望或减仓</div>
            <div className="text-[#4a6fa5] text-xs mt-0.5">已持有者关注下方支撑是否破位</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e3a5f]/20">
          <div>
            <div className="text-[#4a6fa5] text-xs">关键阻力</div>
            <div className="font-mono text-[#ff4757] font-bold">{resistance.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[#4a6fa5] text-xs">关键支撑</div>
            <div className="font-mono text-[#00ff88] font-bold">{support.toFixed(2)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-start gap-2">
        <Activity size={14} className="text-[#ffd700] mt-0.5 shrink-0" />
        <div>
          <div className="text-white/90 font-bold">区间震荡,高抛低吸</div>
          <div className="text-[#4a6fa5] text-xs mt-0.5">在支撑位附近关注企稳信号,阻力位附近考虑减仓</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e3a5f]/20">
        <div>
          <div className="text-[#4a6fa5] text-xs">震荡上沿</div>
          <div className="font-mono text-[#ff4757] font-bold">{resistance.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[#4a6fa5] text-xs">震荡下沿</div>
          <div className="font-mono text-[#00ff88] font-bold">{support.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

// K线图配置
function buildChartOption(pred: HourPrediction) {
  const dates = pred.predictedBars.map(b => b.time);
  const ohlc = pred.predictedBars.map(b => [b.open, b.close, b.low, b.high]);
  const volumes = pred.predictedBars.map((b, i) => ({
    value: b.volume,
    itemStyle: { color: b.close >= b.open ? '#ff4757' : '#00ff88' },
  }));

  return {
    backgroundColor: 'transparent',
    animation: true,
    legend: {
      data: ['预测K线', '成交量'],
      textStyle: { color: '#4a6fa5', fontSize: 11 },
      top: 4,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(13, 19, 51, 0.95)',
      borderColor: '#1e3a5f',
      textStyle: { color: '#fff', fontSize: 11 },
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: 50, right: 20, top: 36, height: '60%' },
      { left: 50, right: 20, top: '76%', height: '16%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        axisLabel: { color: '#4a6fa5', fontSize: 10 },
        splitLine: { show: false },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: dates,
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        axisLabel: { show: false },
      },
    ],
    yAxis: [
      {
        scale: true,
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        axisLabel: { color: '#4a6fa5', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1e3a5f', opacity: 0.2 } },
      },
      {
        gridIndex: 1,
        axisLine: { lineStyle: { color: '#1e3a5f' } },
        axisLabel: { show: false },
        splitNumber: 2,
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
    ],
    series: [
      {
        name: '预测K线',
        type: 'candlestick',
        data: ohlc,
        itemStyle: {
          color: '#ff4757',       // 阳线红
          color0: '#00ff88',      // 阴线绿
          borderColor: '#ff4757',
          borderColor0: '#00ff88',
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#ffd700', type: 'dashed', width: 1 },
          label: { color: '#ffd700', fontSize: 10 },
          data: [
            {
              yAxis: pred.predictedClose,
              name: `目标价 ${pred.predictedClose.toFixed(2)}`,
            },
          ],
        },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
      },
    ],
  };
}
