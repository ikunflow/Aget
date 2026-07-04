import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useStockStore } from '@/store/useStockStore';
import { useAuth } from '@/hooks/useAuth';
import { usePredictions } from '@/hooks/usePredictions';
import { fetchKline, fetchMarketHeat } from '@/utils/api';
import { calcAllIndicators } from '@/utils/indicators';
import { predictHour, type HourPrediction } from '@/utils/hourPredictor';
import type { DailyBar } from '@/utils/types';
import { Search, Loader2, Clock, TrendingUp, TrendingDown, Activity, Zap, BarChart3, AlertCircle, CheckCircle2, Target, ShieldAlert, Database, History, Check, X } from 'lucide-react';

export default function RealtimePredict() {
  const { searchQuery, searchResults, setSearchQuery, selectStock, stockCode, stockName, bars, loading, useRealData } = useStockStore();
  const { user } = useAuth();
  const { records, loading: recordsLoading, savePrediction, resolvePending, stats } = usePredictions(user?.uid || null);
  const [hourPred, setHourPred] = useState<HourPrediction | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60); // 秒

  // 当选中股票时,执行小时级预测
  const runPrediction = useCallback(async (code: string, name?: string) => {
    setPredicting(true);
    try {
      const klineData = await fetchKline(code, 250);
      if (klineData.bars.length < 20) return;
      const bars = klineData.bars;
      const indicators = calcAllIndicators(bars);
      const heat = await fetchMarketHeat().catch(() => ({ heat: 50, label: '温和' }));
      // 注意: predictHour 现在接收 code 作为第一个参数(用于确定性种子)
      const pred = predictHour(code, bars, indicators, heat.heat);
      setHourPred(pred);
      setLastUpdate(new Date());
      // 保存到数据库(用最后一根K线的日期作为 baseDate)
      if (user) {
        const lastBar = bars[bars.length - 1];
        await savePrediction(
          pred,
          code,
          name || stockName || code,
          lastBar.date,
          lastBar.close
        );
      }
    } catch (e) {
      console.error('小时预测失败:', e);
    } finally {
      setPredicting(false);
    }
  }, [user, stockName, savePrediction]);

  // 监听选中股票
  useEffect(() => {
    if (stockCode && stockCode.length === 6) {
      runPrediction(stockCode, stockName);
    }
  }, [stockCode, stockName, runPrediction]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || !stockCode) return;
    const timer = setInterval(() => runPrediction(stockCode, stockName), refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, stockCode, stockName, refreshInterval, runPrediction]);

  // 进入页面时,自动回填未对比的预测(优先在后台执行,不阻塞UI)
  useEffect(() => {
    if (user && records.length > 0 && stats.resolved < stats.total) {
      // 静默触发,不显示loading
      resolvePending().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
              onClick={() => runPrediction(stockCode, stockName)}
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

          {/* 历史准确率统计 */}
          {user && (
            <AccuracyPanel
              records={records}
              stats={stats}
              loading={recordsLoading}
              currentCode={stockCode}
              currentName={stockName}
              onResolve={resolvePending}
            />
          )}
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

// 准确率统计面板
function AccuracyPanel({ records, stats, loading, currentCode, currentName, onResolve }: {
  records: import('@/hooks/usePredictions').PredictionRecord[];
  stats: {
    total: number;
    resolved: number;
    correct: number;
    incorrect: number;
    accuracy: number | null;
  };
  loading: boolean;
  currentCode: string;
  currentName: string;
  onResolve: () => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [resolving, setResolving] = useState(false);
  const accuracyColor = stats.accuracy === null
    ? '#4a6fa5'
    : stats.accuracy >= 0.6
    ? '#ff4757'
    : stats.accuracy >= 0.4
    ? '#ffd700'
    : '#00ff88';

  // 当前股票的最近记录
  const currentStockRecords = records.filter(r => r.code === currentCode);
  // 显示最近5条或全部
  const displayRecords = (showAll ? records : records.slice(0, 5));

  return (
    <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-bold flex items-center gap-1.5">
          <Database size={14} className="text-[#ffd700]" />
          预测准确率统计
        </h3>
        <button
          onClick={async () => {
            setResolving(true);
            try { await onResolve(); } finally { setResolving(false); }
          }}
          disabled={resolving || stats.resolved === stats.total}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] rounded-lg text-xs hover:bg-[#00ff88]/20 disabled:opacity-40"
        >
          {resolving ? <Loader2 size={11} className="animate-spin" /> : <History size={11} />}
          对比历史
        </button>
      </div>

      {loading ? (
        <div className="py-4 text-center text-[#4a6fa5] text-xs">加载中...</div>
      ) : records.length === 0 ? (
        <div className="py-4 text-center text-[#4a6fa5] text-xs">
          暂无历史预测。选择股票后会自动保存预测,1天后系统会自动对比实际收盘价。
        </div>
      ) : (
        <>
          {/* 核心统计卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="bg-[#0a0e27]/60 rounded-lg p-2.5">
              <div className="text-[#4a6fa5] text-[10px] uppercase tracking-wider">总预测数</div>
              <div className="text-white/90 font-mono font-bold text-base mt-0.5">{stats.total}</div>
            </div>
            <div className="bg-[#0a0e27]/60 rounded-lg p-2.5">
              <div className="text-[#4a6fa5] text-[10px] uppercase tracking-wider">已对比</div>
              <div className="text-white/90 font-mono font-bold text-base mt-0.5">{stats.resolved}</div>
            </div>
            <div className="bg-[#0a0e27]/60 rounded-lg p-2.5">
              <div className="text-[#4a6fa5] text-[10px] uppercase tracking-wider">命中/失误</div>
              <div className="font-mono font-bold text-base mt-0.5">
                <span className="text-[#ff4757]">{stats.correct}</span>
                <span className="text-[#4a6fa5]"> / </span>
                <span className="text-[#00ff88]">{stats.incorrect}</span>
              </div>
            </div>
            <div className="bg-[#0a0e27]/60 rounded-lg p-2.5">
              <div className="text-[#4a6fa5] text-[10px] uppercase tracking-wider">准确率</div>
              <div className="font-mono font-bold text-base mt-0.5" style={{ color: accuracyColor }}>
                {stats.accuracy === null ? '--' : `${(stats.accuracy * 100).toFixed(1)}%`}
              </div>
            </div>
          </div>

          {/* 当前股票统计 */}
          {currentStockRecords.length > 0 && (
            <div className="text-xs text-[#4a6fa5] mb-2">
              <span className="text-white/80">{currentName || currentCode}</span>
              {' '}已记录 <span className="text-white/90 font-mono">{currentStockRecords.length}</span> 次预测
              {currentStockRecords.some(r => r.resolved) && (
                <>
                  ,其中命中 <span className="text-[#ff4757] font-mono">{currentStockRecords.filter(r => r.isCorrect).length}</span> 次
                </>
              )}
            </div>
          )}

          {/* 历史记录表 */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#4a6fa5] border-b border-[#1e3a5f]/30">
                  <th className="text-left py-1.5 font-medium">代码</th>
                  <th className="text-left py-1.5 font-medium">预测日</th>
                  <th className="text-right py-1.5 font-medium">预测价</th>
                  <th className="text-right py-1.5 font-medium">实际价</th>
                  <th className="text-right py-1.5 font-medium">结果</th>
                </tr>
              </thead>
              <tbody>
                {displayRecords.map((r) => {
                  const result = !r.resolved
                    ? <span className="text-[#4a6fa5]">待对比</span>
                    : r.isCorrect === true
                    ? <span className="text-[#ff4757] flex items-center justify-end gap-0.5"><Check size={10} />命中</span>
                    : r.isCorrect === false
                    ? <span className="text-[#00ff88] flex items-center justify-end gap-0.5"><X size={10} />失误</span>
                    : <span className="text-[#ffd700]">震荡</span>;
                  return (
                    <tr key={r.id} className="border-b border-[#1e3a5f]/15 hover:bg-[#1e3a5f]/10">
                      <td className="py-1.5 text-white/80 font-mono">{r.code}</td>
                      <td className="py-1.5 text-[#4a6fa5]">{r.baseDate}</td>
                      <td className="py-1.5 text-right font-mono text-white/80">
                        {r.predictedClose.toFixed(2)}
                        <div className="text-[10px]" style={{ color: r.predictedChange >= 0 ? '#ff4757' : '#00ff88' }}>
                          {r.predictedChange >= 0 ? '+' : ''}{r.predictedChange.toFixed(2)}%
                        </div>
                      </td>
                      <td className="py-1.5 text-right font-mono">
                        {r.actualClose !== null ? (
                          <>
                            <span className="text-white/80">{r.actualClose.toFixed(2)}</span>
                            <div className="text-[10px]" style={{ color: (r.actualChange || 0) >= 0 ? '#ff4757' : '#00ff88' }}>
                              {(r.actualChange || 0) >= 0 ? '+' : ''}{(r.actualChange || 0).toFixed(2)}%
                            </div>
                          </>
                        ) : (
                          <span className="text-[#4a6fa5]">--</span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">{result}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {records.length > 5 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full mt-2 py-1.5 text-xs text-[#1e90ff] hover:bg-[#1e90ff]/10 rounded-lg"
              >
                {showAll ? '收起' : `查看全部 ${records.length} 条记录`}
              </button>
            )}
          </div>
        </>
      )}
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
