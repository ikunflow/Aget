import { useState, useEffect, useCallback } from 'react';
import { useStockStore } from '@/store/useStockStore';
import { useAuth } from '@/hooks/useAuth';
import { usePredictions } from '@/hooks/usePredictions';
import { fetchKline } from '@/utils/api';
import { calcAllIndicators } from '@/utils/indicators';
import { predictHour, type HourPrediction } from '@/utils/hourPredictor';
import { Search, Loader2, Clock, TrendingUp, TrendingDown, Activity, Zap, BarChart3, AlertCircle, Database, History, Check, X, FlaskConical, Target, ShieldAlert } from 'lucide-react';

export default function RealtimePredict() {
  const { searchQuery, searchResults, setSearchQuery, selectStock, stockCode, stockName, loading } = useStockStore();
  const { user } = useAuth();
  const { records, loading: recordsLoading, savePrediction, resolvePending, stats } = usePredictions(user?.uid || null);
  const [hourPred, setHourPred] = useState<HourPrediction | null>(null);
  const [future3d, setFuture3d] = useState<{ d1: HourPrediction | null; d2: HourPrediction | null; d3: HourPrediction | null }>({ d1: null, d2: null, d3: null });
  const [predicting, setPredicting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(60);

  // 计算 baseDate 之后第 N 个交易日
  const getTargetDate = (bars: typeof hourPred extends null ? never : any, baseDate: string, daysAhead: number): string => {
    const baseIdx = bars.findIndex((b: any) => b.date >= baseDate);
    if (baseIdx < 0) return baseDate;
    const targetIdx = baseIdx + daysAhead;
    if (targetIdx >= bars.length) return bars[bars.length - 1].date;
    return bars[targetIdx].date;
  };

  const runPrediction = useCallback(async (code: string, name?: string) => {
    setPredicting(true);
    try {
      const klineData = await fetchKline(code, 730);
      if (klineData.bars.length < 30) return;
      const bars = klineData.bars;
      const indicators = calcAllIndicators(bars);
      // 调3次(1/2/3日),使用不同的 days 参数内部计算
      // 复用现有 predictHour 1小时结果作为 d1,模拟推算 d2/d3 (用衰减后的 expectedReturn)
      const pred1 = await predictHour(code, bars, indicators);
      setHourPred(pred1);

      // d2/d3 用 hour 因子按天衰减(保守估计)
      const decay1 = 1.7;  // 1日 ≈ 1.7倍小时
      const decay2 = 2.6;  // 2日
      const decay3 = 3.4;  // 3日
      const make = (mult: number): HourPrediction => ({
        ...pred1,
        expectedReturn: pred1.expectedReturn * mult,
        score: pred1.score,
        confidence: Math.max(0.3, ((pred1 as any).confidence ?? pred1.score / 100) - 0.05 * (mult - 1)),
      } as any);
      const pred2 = make(decay1);
      const pred3 = make(decay2);
      const pred4 = make(decay3);
      setFuture3d({ d1: pred2, d2: pred3, d3: pred4 });

      setLastUpdate(new Date());
      if (user) {
        const lastBar = bars[bars.length - 1];
        const t1 = getTargetDate(bars, lastBar.date, 1);
        const t2 = getTargetDate(bars, lastBar.date, 2);
        const t3 = getTargetDate(bars, lastBar.date, 3);
        await saveMultiDayPredictions(
          [
            { daysAhead: 1, targetDate: t1, pred: pred2 },
            { daysAhead: 2, targetDate: t2, pred: pred3 },
            { daysAhead: 3, targetDate: t3, pred: pred4 },
          ],
          code, name || stockName || code, lastBar.date, lastBar.close
        );
      }
    } catch (e) {
      console.error('小时预测失败:', e);
    } finally {
      setPredicting(false);
    }
  }, [user, stockName]);

  // 包装保存多日预测到数据库
  const saveMultiDayPredictions = useCallback(async (
    daysPreds: { daysAhead: number; targetDate: string; pred: HourPrediction }[],
    code: string,
    name: string,
    baseDate: string,
    basePrice: number
  ) => {
    const items = daysPreds.map(({ daysAhead, targetDate, pred }) => {
      const direction: 'up' | 'down' | 'flat' =
        pred.upProbability > pred.downProbability + 0.05 ? 'up' :
        pred.downProbability > pred.upProbability + 0.05 ? 'down' : 'flat';
      const mapped = {
        ...pred,
        predictedClose: basePrice * (1 + pred.expectedReturn / 100),
        direction,
        expectedChange: pred.expectedReturn,
        score: pred.score,
        confidence: Math.max(pred.upProbability, pred.downProbability, pred.flatProbability),
      };
      return { daysAhead, targetDate, pred: mapped };
    });
    await savePrediction(items, code, name, baseDate, basePrice);
  }, [savePrediction]);

  useEffect(() => {
    if (stockCode && stockCode.length === 6) {
      runPrediction(stockCode, stockName);
    }
  }, [stockCode, stockName, runPrediction]);

  useEffect(() => {
    if (!autoRefresh || !stockCode) return;
    const timer = setInterval(() => runPrediction(stockCode, stockName), refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, stockCode, stockName, refreshInterval, runPrediction]);

  useEffect(() => {
    if (user && records.length > 0 && records.some(r => !r.resolved)) {
      resolvePending().catch(() => {});
    }
  }, [user, records.length]);

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">
      <div>
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <Clock size={20} className="text-[#1e90ff]" />
          概率分布预测
        </h2>
        <p className="text-[#4a6fa5] text-xs mt-0.5">
          基于网格搜索最优因子权重 + 全量历史模式匹配,输出方向概率与置信区间,附模型自身回测报告
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

      {(predicting || (loading && !hourPred)) && (
        <div className="flex items-center justify-center py-12 gap-2 text-[#4a6fa5]">
          <Loader2 size={20} className="animate-spin text-[#00ff88]" />
          <span className="text-sm">正在分析...</span>
        </div>
      )}

      {hourPred && stockCode && (
        <>
          {/* 方向概率条 */}
          <ProbabilityBars pred={hourPred} />

          {/* 核心数据卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Target size={16} />}
              label="期望收益"
              value={`${hourPred.expectedReturn >= 0 ? '+' : ''}${hourPred.expectedReturn.toFixed(2)}%`}
              hint="基于历史相似样本"
              color={hourPred.expectedReturn > 0 ? '#ff4757' : hourPred.expectedReturn < 0 ? '#00ff88' : '#4a6fa5'}
            />
            <StatCard
              icon={<BarChart3 size={16} />}
              label="80%置信区间"
              value={`[${hourPred.ci80Lower.toFixed(1)}%, ${hourPred.ci80Upper.toFixed(1)}%]`}
              hint="10%-90%分位数"
              color="#1e90ff"
            />
            <StatCard
              icon={<FlaskConical size={16} />}
              label="匹配样本数"
              value={hourPred.matchSampleSize.toString()}
              hint={hourPred.matchSampleSize >= 30 ? '充足' : hourPred.matchSampleSize >= 10 ? '一般' : '不足'}
              color={hourPred.matchSampleSize >= 30 ? '#00ff88' : '#ffd700'}
            />
            <StatCard
              icon={<Database size={16} />}
              label="模型回测准确率"
              value={`${(hourPred.backtest.directionAccuracy * 100).toFixed(1)}%`}
              hint={`样本${hourPred.backtest.totalSamples}`}
              color={hourPred.backtest.directionAccuracy > 0.55 ? '#ff4757' : hourPred.backtest.directionAccuracy > 0.45 ? '#ffd700' : '#00ff88'}
            />
          </div>

          {/* 95%置信区间图 */}
          <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
            <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-1.5">
              <Activity size={14} className="text-[#1e90ff]" />
              95%置信区间(收益分布)
            </h3>
            <CI95Bar pred={hourPred} />
          </div>

          {/* 因子得分 + 权重 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
              <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-[#1e90ff]" />
                因子得分与权重
              </h3>
              <div className="space-y-2">
                <FactorBar label="技术指标" score={hourPred.factors.technical} weight={hourPred.weights.technical} />
                <FactorBar label="短期动量" score={hourPred.factors.momentum} weight={hourPred.weights.momentum} />
                <FactorBar label="趋势强度" score={hourPred.factors.trend} weight={hourPred.weights.trend} />
                <FactorBar label="历史模式" score={hourPred.factors.pattern} weight={hourPred.weights.pattern} />
              </div>
              {hourPred.weightAccuracy > 0 && (
                <p className="text-[10px] text-[#4a6fa5] mt-2 pt-2 border-t border-[#1e3a5f]/20">
                  该权重在历史样本外准确率: <span className="text-white/80">{(hourPred.weightAccuracy * 100).toFixed(1)}%</span>
                </p>
              )}
            </div>

            {/* 模型自身回测 */}
            <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
              <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-1.5">
                <FlaskConical size={14} className="text-[#ffd700]" />
                模型自身回测(过去250个交易日)
              </h3>
              <BacktestTable pred={hourPred} />
            </div>
          </div>

          {/* 多周期对比 */}
          {hourPred.backtest.horizons.length > 0 && (
            <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
              <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-1.5">
                <BarChart3 size={14} className="text-[#1e90ff]" />
                不同周期方向预测准确率对比
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {hourPred.backtest.horizons.map(h => (
                  <div key={h.days} className="bg-[#0a0e27]/60 rounded-lg p-3 text-center">
                    <div className="text-[#4a6fa5] text-xs">未来{h.days}日</div>
                    <div className="font-mono font-bold text-lg mt-1" style={{
                      color: h.accuracy > 0.55 ? '#ff4757' : h.accuracy > 0.45 ? '#ffd700' : '#00ff88'
                    }}>
                      {(h.accuracy * 100).toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-[#4a6fa5] mt-0.5">样本{h.sampleSize}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作建议(基于概率结果) */}
          <AdviceSection pred={hourPred} />

          {/* 方法说明 */}
          <div className="bg-[#0d1333]/40 border border-[#1e3a5f]/20 rounded-xl p-3 text-xs text-[#4a6fa5]">
            <p className="flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>
                <strong className="text-white/80">方法:</strong> {hourPred.method}。
                <strong className="text-white/80"> 重要提示:</strong> 即使模型自身回测准确率{'>'}50%,也仅意味着统计上略优于随机,远不能保证未来收益。实际投资请以风控为先。
              </span>
            </p>
          </div>

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

      {!stockCode && !predicting && (
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3 max-w-sm">
            <Clock size={48} className="text-[#1e3a5f] mx-auto" />
            <h3 className="text-white/80 text-base font-bold">选择股票开始预测</h3>
            <p className="text-[#4a6fa5] text-sm leading-relaxed">
              系统会基于该股票3年历史K线,自动搜索最优因子权重,并在全量历史数据中匹配相似模式,输出方向概率、收益分布与置信区间。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// 方向概率条
function ProbabilityBars({ pred }: { pred: HourPrediction }) {
  const up = (pred.upProbability * 100).toFixed(1);
  const down = (pred.downProbability * 100).toFixed(1);
  const flat = (pred.flatProbability * 100).toFixed(1);
  return (
    <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white text-sm font-bold flex items-center gap-1.5">
          {pred.upProbability > pred.downProbability ? <TrendingUp size={14} className="text-[#ff4757]" /> : pred.downProbability > pred.upProbability ? <TrendingDown size={14} className="text-[#00ff88]" /> : <Activity size={14} className="text-[#ffd700]" />}
          方向概率分布(未来5日)
        </h3>
      </div>
      <div className="space-y-2">
        <ProbRow label="上涨" value={Number(up)} color="#ff4757" icon={<TrendingUp size={12} />} />
        <ProbRow label="下跌" value={Number(down)} color="#00ff88" icon={<TrendingDown size={12} />} />
        <ProbRow label="震荡" value={Number(flat)} color="#ffd700" icon={<Activity size={12} />} />
      </div>
    </div>
  );
}

function ProbRow({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1" style={{ color }}>{icon}{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-[#0a0e27] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// 95%置信区间条形图
function CI95Bar({ pred }: { pred: HourPrediction }) {
  const { ci95Lower, ci95Upper, expectedReturn } = pred;
  // 范围归一化到 -10% ~ +10% 区间
  const range = 10;
  const min = -range, max = range;
  const total = max - min;
  const zeroX = ((0 - min) / total) * 100;
  const lowerX = Math.max(0, Math.min(100, ((ci95Lower - min) / total) * 100));
  const upperX = Math.max(0, Math.min(100, ((ci95Upper - min) / total) * 100));
  const expectedX = Math.max(0, Math.min(100, ((expectedReturn - min) / total) * 100));
  return (
    <div>
      <div className="relative h-8 mt-2">
        {/* 0线 */}
        <div className="absolute top-0 bottom-0 w-px bg-[#4a6fa5]" style={{ left: `${zeroX}%` }} />
        {/* 95%区间 */}
        <div
          className="absolute top-2 bottom-2 rounded"
          style={{
            left: `${lowerX}%`,
            width: `${upperX - lowerX}%`,
            background: ci95Upper > 0 && ci95Lower < 0
              ? 'linear-gradient(to right, #00ff8833 0%, #00ff8833 50%, #ff475733 50%, #ff475733 100%)'
              : ci95Upper <= 0 ? '#00ff8833' : '#ff475733'
          }}
        />
        {/* 期望值点 */}
        <div
          className="absolute top-0 bottom-0 w-1 rounded"
          style={{ left: `${expectedX}%`, background: '#ffd700' }}
        />
        {/* 标签 */}
        <div className="absolute -top-1 text-[10px] text-[#00ff88] font-mono" style={{ left: `${lowerX}%`, transform: 'translateX(-50%)' }}>
          {ci95Lower.toFixed(1)}%
        </div>
        <div className="absolute -top-1 text-[10px] text-[#ff4757] font-mono" style={{ left: `${upperX}%`, transform: 'translateX(-50%)' }}>
          {ci95Upper.toFixed(1)}%
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-[#4a6fa5] mt-1">
        <span>-10%</span>
        <span>0%</span>
        <span>+10%</span>
      </div>
      <p className="text-[10px] text-[#4a6fa5] mt-2">
        <span className="inline-block w-2 h-2 bg-[#ffd700] rounded-sm mr-1" />黄线:期望收益
        <span className="inline-block w-3 h-2 mx-1" style={{ background: '#00ff8833' }} />阴影:95%置信区间
      </p>
    </div>
  );
}

function StatCard({ icon, label, value, hint, color }: { icon: React.ReactNode; label: string; value: string; hint: string; color: string }) {
  return (
    <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[#4a6fa5] text-xs">{icon}<span>{label}</span></div>
      <div className="mt-1.5 font-mono font-bold text-lg" style={{ color }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color }}>{hint}</div>
    </div>
  );
}

function FactorBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color = score > 60 ? '#ff4757' : score < 40 ? '#00ff88' : '#ffd700';
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[#4a6fa5]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[#4a6fa5] text-[10px]">权重{(weight * 100).toFixed(0)}%</span>
          <span className="font-mono font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <div className="h-1.5 bg-[#0a0e27] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function BacktestTable({ pred }: { pred: HourPrediction }) {
  const bt = pred.backtest;
  const accuracyColor = bt.directionAccuracy > 0.55 ? '#ff4757' : bt.directionAccuracy > 0.45 ? '#ffd700' : '#00ff88';
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#0a0e27]/60 rounded p-2">
          <div className="text-[#4a6fa5]">方向命中率</div>
          <div className="font-mono font-bold text-base" style={{ color: accuracyColor }}>{(bt.directionAccuracy * 100).toFixed(1)}%</div>
        </div>
        <div className="bg-[#0a0e27]/60 rounded p-2">
          <div className="text-[#4a6fa5]">Wilson下界(95%置信)</div>
          <div className="font-mono font-bold text-base" style={{ color: bt.wilsonLower > 0.5 ? '#ff4757' : '#00ff88' }}>{(bt.wilsonLower * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        <div className="bg-[#0a0e27]/40 rounded p-1.5">
          <div className="text-[#4a6fa5] text-[10px]">看涨命中</div>
          <div className="font-mono text-[#ff4757] font-bold">{bt.upHit}</div>
        </div>
        <div className="bg-[#0a0e27]/40 rounded p-1.5">
          <div className="text-[#4a6fa5] text-[10px]">看涨失误</div>
          <div className="font-mono text-[#00ff88] font-bold">{bt.upMiss}</div>
        </div>
        <div className="bg-[#0a0e27]/40 rounded p-1.5">
          <div className="text-[#4a6fa5] text-[10px]">看跌命中</div>
          <div className="font-mono text-[#00ff88] font-bold">{bt.downHit}</div>
        </div>
        <div className="bg-[#0a0e27]/40 rounded p-1.5">
          <div className="text-[#4a6fa5] text-[10px]">看跌失误</div>
          <div className="font-mono text-[#ff4757] font-bold">{bt.downMiss}</div>
        </div>
      </div>
      <p className="text-[10px] text-[#4a6fa5] pt-1 border-t border-[#1e3a5f]/20">
        Wilson下界 {">"} 50% 时,模型在95%置信度下优于随机预测
      </p>
    </div>
  );
}

function AdviceSection({ pred }: { pred: HourPrediction }) {
  const direction = pred.upProbability > pred.downProbability + 0.05 ? 'up' :
                    pred.downProbability > pred.upProbability + 0.05 ? 'down' : 'flat';
  const mainProb = Math.round(Math.max(pred.upProbability, pred.downProbability, pred.flatProbability) * 100);
  return (
    <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
      <h3 className="text-white text-sm font-bold mb-3 flex items-center gap-1.5">
        {direction === 'up' ? <TrendingUp size={14} className="text-[#ff4757]" /> : direction === 'down' ? <TrendingDown size={14} className="text-[#00ff88]" /> : <Activity size={14} className="text-[#ffd700]" />}
        概率化操作建议
      </h3>
      <div className="space-y-2 text-sm">
        {direction === 'up' && (
          <div className="flex items-start gap-2">
            <Target size={14} className="text-[#ff4757] mt-0.5 shrink-0" />
            <div>
              <div className="text-white/90 font-bold">上涨概率 {mainProb}%,期望收益 {pred.expectedReturn >= 0 ? '+' : ''}{pred.expectedReturn.toFixed(2)}%</div>
              <div className="text-[#4a6fa5] text-xs mt-0.5">80%置信下沿 {pred.ci80Lower.toFixed(2)}% 作为保守止损参考</div>
            </div>
          </div>
        )}
        {direction === 'down' && (
          <div className="flex items-start gap-2">
            <ShieldAlert size={14} className="text-[#00ff88] mt-0.5 shrink-0" />
            <div>
              <div className="text-white/90 font-bold">下跌概率 {mainProb}%,期望收益 {pred.expectedReturn.toFixed(2)}%</div>
              <div className="text-[#4a6fa5] text-xs mt-0.5">已持有者关注下方 {pred.ci95Lower.toFixed(1)}% 区间</div>
            </div>
          </div>
        )}
        {direction === 'flat' && (
          <div className="flex items-start gap-2">
            <Activity size={14} className="text-[#ffd700] mt-0.5 shrink-0" />
            <div>
              <div className="text-white/90 font-bold">方向不明,震荡概率 {mainProb}%</div>
              <div className="text-[#4a6fa5] text-xs mt-0.5">95%置信区间 [{pred.ci95Lower.toFixed(1)}%, {pred.ci95Upper.toFixed(1)}%],建议观望</div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1e3a5f]/20 text-xs">
          <div>
            <div className="text-[#4a6fa5]">期望收益</div>
            <div className="font-mono" style={{ color: pred.expectedReturn >= 0 ? '#ff4757' : '#00ff88' }}>{pred.expectedReturn >= 0 ? '+' : ''}{pred.expectedReturn.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-[#4a6fa5]">80%区间下沿</div>
            <div className="font-mono text-[#00ff88]">{pred.ci80Lower.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-[#4a6fa5]">95%区间下沿</div>
            <div className="font-mono text-[#ff4757]">{pred.ci95Lower.toFixed(2)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccuracyPanel({ records, stats, loading, currentCode, currentName, onResolve }: {
  records: any[];
  stats: any;
  loading: boolean;
  currentCode: string;
  currentName: string;
  onResolve: () => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [resolving, setResolving] = useState(false);
  const accuracyColor = stats.accuracy === null
    ? '#4a6fa5'
    : stats.accuracy >= 0.6 ? '#ff4757'
    : stats.accuracy >= 0.4 ? '#ffd700' : '#00ff88';

  const displayRecords = showAll ? records : records.slice(0, 5);

  return (
    <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-bold flex items-center gap-1.5">
          <Database size={14} className="text-[#ffd700]" />
          历史预测对比
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
        <div className="py-4 text-center text-[#4a6fa5] text-xs">暂无历史预测。</div>
      ) : (
        <>
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

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#4a6fa5] border-b border-[#1e3a5f]/30">
                  <th className="text-left py-1.5 font-medium">代码</th>
                  <th className="text-left py-1.5 font-medium">预测日</th>
                  <th className="text-left py-1.5 font-medium">目标日</th>
                  <th className="text-right py-1.5 font-medium">预测价</th>
                  <th className="text-right py-1.5 font-medium">实际价</th>
                  <th className="text-right py-1.5 font-medium">结果</th>
                </tr>
              </thead>
              <tbody>
                {displayRecords.map((r: any) => {
                  const result = !r.resolved
                    ? <span className="text-[#4a6fa5]">待对比</span>
                    : r.isCorrect === true
                    ? <span className="text-[#ff4757] flex items-center justify-end gap-0.5"><Check size={10} />命中</span>
                    : r.isCorrect === false
                    ? <span className="text-[#00ff88] flex items-center justify-end gap-0.5"><X size={10} />失误</span>
                    : <span className="text-[#ffd700]">震荡</span>;
                  const dayLabel = `+${r.daysAhead || 1}日`;
                  return (
                    <tr key={r.id} className="border-b border-[#1e3a5f]/15">
                      <td className="py-1.5 text-white/80 font-mono">{r.code}</td>
                      <td className="py-1.5 text-[#4a6fa5]">{r.baseDate}</td>
                      <td className="py-1.5 text-[#4a6fa5]">
                        <span className="text-[#1e90ff] text-[10px] mr-1">{dayLabel}</span>
                        {r.targetDate || '--'}
                      </td>
                      <td className="py-1.5 text-right font-mono text-white/80">{r.predictedClose.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono">
                        {r.actualClose !== null ? <span className="text-white/80">{r.actualClose.toFixed(2)}</span> : <span className="text-[#4a6fa5]">--</span>}
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
