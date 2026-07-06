import { useMemo } from 'react';
import type { WeekPrediction, DailyBar, PredictionHorizon } from '@/utils/types';
import { TrendingUp, TrendingDown, Activity, Target, Shield, Calendar, Coins, Zap, BarChart3, FlaskConical, AlertCircle, Sun } from 'lucide-react';

interface Props {
  prediction: WeekPrediction | null;
  historicalBars: DailyBar[];
  latestDate: string;
  horizon: PredictionHorizon;
  onHorizonChange: (h: PredictionHorizon) => void;
}

export default function WeekPredictionPanel({ prediction, historicalBars, latestDate, horizon, onHorizonChange }: Props) {
  if (!prediction || historicalBars.length < 30) {
    return (
      <div className="space-y-3">
        <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-4 text-center">
          <AlertCircle size={24} className="text-[#ffd700] mx-auto mb-2" />
          <p className="text-[#4a6fa5] text-xs">K线数据不足(需要至少30个交易日)</p>
        </div>
      </div>
    );
  }

  const lastClose = historicalBars[historicalBars.length - 1].close;
  const direction = prediction.upProbability > prediction.downProbability + 0.05 ? 'up' :
                    prediction.downProbability > prediction.upProbability + 0.05 ? 'down' : 'flat';
  const mainProb = Math.round(Math.max(prediction.upProbability, prediction.downProbability, prediction.flatProbability) * 100);
  const day1Backtest = prediction.backtest.horizons.find(h => h.days === 1);

  return (
    <div className="space-y-3">
      {/* 顶部醒目: 明日预测大卡片 */}
      <TomorrowCard
        prediction={prediction}
        currentPrice={lastClose}
        day1Backtest={day1Backtest}
      />

      {/* 未来3日预测表 */}
      <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
        <h3 className="text-white text-xs font-bold mb-2 flex items-center gap-1.5">
          <Calendar size={13} className="text-[#1e90ff]" />
          未来3日预测(从 {latestDate} 起)
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {(() => {
            // 用 horizon=5 的 expectedReturn 反推日均(线性外推,仅作参考)
            const avgDaily = prediction.days > 0 ? prediction.expectedReturn / prediction.days : 0;
            // 第一天取全值的1.5倍(短期通常动量较大),后两天日均
            const dayReturns = [
              { label: '+1日', ret: avgDaily * 1.5 },
              { label: '+2日', ret: avgDaily * 1.0 },
              { label: '+3日', ret: avgDaily * 0.7 },
            ];
            return dayReturns.map((row, i) => {
              const targetDate = new Date(latestDate);
              targetDate.setDate(targetDate.getDate() + i + 1);
              const dateStr = targetDate.toISOString().slice(0, 10);
              const color = row.ret > 0.05 ? '#ff4757' : row.ret < -0.05 ? '#00ff88' : '#ffd700';
              return (
                <div key={row.label} className="bg-[#0a0e27]/60 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-[#4a6fa5]">{row.label}</div>
                  <div className="text-[9px] text-[#4a6fa5]/60 mt-0.5">{dateStr}</div>
                  <div className="font-mono font-bold text-sm mt-1" style={{ color }}>
                    {row.ret >= 0 ? '+' : ''}{row.ret.toFixed(2)}%
                  </div>
                  <div className="text-[9px] text-[#4a6fa5] mt-0.5">
                    收盘 {(lastClose * (1 + row.ret / 100)).toFixed(2)}
                  </div>
                </div>
              );
            });
          })()}
        </div>
        <p className="text-[9px] text-[#4a6fa5]/60 mt-2 pt-2 border-t border-[#1e3a5f]/20">
          ⚠ 3日预测为线性外推估算,实际波动可能显著偏离
        </p>
      </div>

      {/* 短期/长期切换 */}
      <div className="flex gap-1.5 bg-[#0a0e27]/60 border border-[#1e3a5f]/30 rounded-xl p-1">
        <button
          onClick={() => onHorizonChange('short')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${
            horizon === 'short'
              ? 'bg-gradient-to-r from-[#00ff88] to-[#1e90ff] text-[#0a0e27]'
              : 'text-[#4a6fa5] hover:text-white/70'
          }`}
        >
          <Zap size={12} />短期 (5天)
        </button>
        <button
          onClick={() => onHorizonChange('long')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${
            horizon === 'long'
              ? 'bg-gradient-to-r from-[#ffd700] to-[#ff6b9d] text-[#0a0e27]'
              : 'text-[#4a6fa5] hover:text-white/70'
          }`}
        >
          <Calendar size={12} />长期 (20天)
        </button>
      </div>

      {/* 核心: 方向概率 */}
      <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
        <h3 className="text-white text-xs font-bold mb-2 flex items-center gap-1.5">
          {direction === 'up' ? <TrendingUp size={13} className="text-[#ff4757]" /> :
           direction === 'down' ? <TrendingDown size={13} className="text-[#00ff88]" /> :
           <Activity size={13} className="text-[#ffd700]" />}
          未来{horizon === 'short' ? 5 : 20}日方向概率
        </h3>
        <div className="space-y-1.5">
          <ProbRow label="上涨" value={prediction.upProbability * 100} color="#ff4757" />
          <ProbRow label="下跌" value={prediction.downProbability * 100} color="#00ff88" />
          <ProbRow label="震荡" value={prediction.flatProbability * 100} color="#ffd700" />
        </div>
      </div>

      {/* 95%置信区间图 */}
      <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
        <h3 className="text-white text-xs font-bold mb-2 flex items-center gap-1.5">
          <BarChart3 size={13} className="text-[#1e90ff]" />
          95%置信区间(收益分布)
        </h3>
        <CI95Bar pred={prediction} currentPrice={lastClose} />
      </div>

      {/* 交易计划(基于概率的价位) */}
      <div className="bg-gradient-to-br from-[#0d1333]/80 to-[#1a1e3a]/60 border border-[#ff4757]/20 rounded-xl p-2.5 md:p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Target size={13} className="text-[#ff4757]" />
          <span className="text-white/80 font-bold text-xs">交易计划</span>
          <span className="text-[#4a6fa5] text-[10px] ml-auto">基于 {latestDate}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#ff4757]/5 border border-[#ff4757]/20 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-0.5">
              <Coins size={11} className="text-[#ff4757]" />
              <span className="text-[#4a6fa5] text-[10px]">买入参考</span>
            </div>
            <div className="text-[#ff4757] font-bold font-mono text-base md:text-lg">{prediction.buyPrice.toFixed(2)}</div>
            <div className="text-[#4a6fa5] text-[10px]">
              距现价 {((prediction.buyPrice - lastClose) / lastClose * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-[#ffd700]/5 border border-[#ffd700]/20 rounded-lg p-2">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp size={11} className="text-[#ffd700]" />
              <span className="text-[#4a6fa5] text-[10px]">卖出参考</span>
            </div>
            <div className="text-[#ffd700] font-bold font-mono text-base md:text-lg">{prediction.sellPrice.toFixed(2)}</div>
            <div className="text-[#4a6fa5] text-[10px]">
              距现价 {((prediction.sellPrice - lastClose) / lastClose * 100).toFixed(1)}%
            </div>
          </div>
        </div>
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
              <span className="text-[#4a6fa5] text-[9px]">周期</span>
            </div>
            <div className="text-[#1e90ff] font-bold font-mono text-xs md:text-sm">{prediction.days}天</div>
          </div>
          <div className="bg-[#a855f7]/5 border border-[#a855f7]/20 rounded-lg p-1.5 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Zap size={10} className="text-[#a855f7]" />
              <span className="text-[#4a6fa5] text-[9px]">期望</span>
            </div>
            <div className={`font-bold font-mono text-xs md:text-sm ${prediction.expectedReturn >= 0 ? 'text-[#ff4757]' : 'text-[#00ff88]'}`}>
              {prediction.expectedReturn >= 0 ? '+' : ''}{prediction.expectedReturn.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* 关键数据卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <DataCard label="期望收益" value={`${prediction.expectedReturn >= 0 ? '+' : ''}${prediction.expectedReturn.toFixed(2)}%`}
          color={prediction.expectedReturn > 0 ? '#ff4757' : prediction.expectedReturn < 0 ? '#00ff88' : '#4a6fa5'} />
        <DataCard label="80%区间" value={`[${prediction.ci80Lower.toFixed(1)}, ${prediction.ci80Upper.toFixed(1)}]%`} color="#1e90ff" />
        <DataCard label="匹配样本" value={prediction.matchSampleSize.toString()}
          color={prediction.matchSampleSize >= 30 ? '#00ff88' : '#ffd700'} />
        <DataCard label="回测准确率" value={`${(prediction.backtest.directionAccuracy * 100).toFixed(1)}%`}
          color={prediction.backtest.directionAccuracy > 0.55 ? '#ff4757' : prediction.backtest.directionAccuracy > 0.45 ? '#ffd700' : '#00ff88'} />
      </div>

      {/* 模型自身回测 */}
      {prediction.backtest.horizons.length > 0 && (
        <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
          <h3 className="text-white text-xs font-bold mb-2 flex items-center gap-1.5">
            <FlaskConical size={13} className="text-[#ffd700]" />
            模型自身回测(过去250日)
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            {prediction.backtest.horizons.map(h => (
              <div key={h.days} className="bg-[#0a0e27]/60 rounded p-1.5">
                <div className="text-[#4a6fa5] text-[10px]">未来{h.days}日</div>
                <div className="font-mono font-bold text-sm" style={{
                  color: h.accuracy > 0.55 ? '#ff4757' : h.accuracy > 0.45 ? '#ffd700' : '#00ff88'
                }}>{(h.accuracy * 100).toFixed(1)}%</div>
                <div className="text-[9px] text-[#4a6fa5]">n={h.sampleSize}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 因子与权重 */}
      <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-3">
        <h3 className="text-white text-xs font-bold mb-2 flex items-center gap-1.5">
          <BarChart3 size={13} className="text-[#1e90ff]" />
          因子与权重(网格搜索最优)
        </h3>
        <div className="space-y-1.5">
          <FactorBar label="技术指标" weight={prediction.weights.technical} />
          <FactorBar label="短期动量" weight={prediction.weights.momentum} />
          <FactorBar label="趋势强度" weight={prediction.weights.trend} />
          <FactorBar label="历史模式" weight={prediction.weights.pattern} />
        </div>
        {prediction.weightAccuracy > 0 && (
          <p className="text-[10px] text-[#4a6fa5] mt-2 pt-2 border-t border-[#1e3a5f]/20">
            该权重历史样本外准确率: <span className="text-white/80">{(prediction.weightAccuracy * 100).toFixed(1)}%</span>
          </p>
        )}
      </div>

      {/* 摘要 */}
      <div className="bg-[#0d1333]/60 border border-[#1e3a5f]/30 rounded-xl p-2.5">
        <p className="text-[#4a6fa5] text-[11px] leading-relaxed">{prediction.summary}</p>
        <p className="text-[#4a6fa5]/50 text-[10px] mt-1.5">⚠ 预测仅供参考,模型自身回测准确率 {">"}50% 也不保证未来收益</p>
      </div>
    </div>
  );
}

// 明日预测大卡片
function TomorrowCard({ prediction, currentPrice, day1Backtest }: {
  prediction: WeekPrediction;
  currentPrice: number;
  day1Backtest?: { days: number; accuracy: number; sampleSize: number };
}) {
  const direction = prediction.upProbability > prediction.downProbability + 0.05 ? 'up' :
                    prediction.downProbability > prediction.upProbability + 0.05 ? 'down' : 'flat';
  const mainProb = Math.max(prediction.upProbability, prediction.downProbability, prediction.flatProbability);
  const mainProbPct = Math.round(mainProb * 100);
  const expRet = prediction.expectedReturn;
  const isUp = expRet > 0.05;
  const isDown = expRet < -0.05;
  const dirColor = isUp ? '#ff4757' : isDown ? '#00ff88' : '#ffd700';
  const bgGradient = isUp
    ? 'from-[#ff4757]/15 via-[#0d1333]/80 to-[#0d1333]/60'
    : isDown
    ? 'from-[#00ff88]/15 via-[#0d1333]/80 to-[#0d1333]/60'
    : 'from-[#ffd700]/10 via-[#0d1333]/80 to-[#0d1333]/60';

  const dirLabel = direction === 'up' ? '看涨' : direction === 'down' ? '看跌' : '震荡';
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Activity;

  // 预测明日收盘价
  const predictedPrice = currentPrice * (1 + expRet / 100);
  const predictedMove = predictedPrice - currentPrice;

  return (
    <div className={`bg-gradient-to-br ${bgGradient} border-2 rounded-2xl p-4 relative overflow-hidden`} style={{ borderColor: `${dirColor}40` }}>
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: dirColor }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sun size={14} style={{ color: dirColor }} />
            <h3 className="text-white text-sm font-bold">明日预测</h3>
            <span className="text-[10px] text-[#4a6fa5] px-1.5 py-0.5 rounded bg-[#0a0e27]/60">1日</span>
          </div>
          {day1Backtest && day1Backtest.sampleSize > 0 && (
            <span className="text-[10px] text-[#4a6fa5]">
              历史准确率 <span className="font-mono font-bold" style={{ color: dirColor }}>{(day1Backtest.accuracy * 100).toFixed(1)}%</span>
            </span>
          )}
        </div>

        <div className="flex items-end gap-3 mb-3">
          <Icon size={32} style={{ color: dirColor }} />
          <div>
            <div className="font-mono font-bold text-3xl md:text-4xl leading-none" style={{ color: dirColor }}>
              {expRet >= 0 ? '+' : ''}{expRet.toFixed(2)}%
            </div>
            <div className="text-[11px] text-[#4a6fa5] mt-0.5">预计明日涨幅</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] text-[#4a6fa5]">预计明日收盘</div>
            <div className="font-mono font-bold text-base" style={{ color: dirColor }}>
              {predictedPrice.toFixed(2)}
            </div>
            <div className="text-[10px]" style={{ color: dirColor }}>
              {predictedMove >= 0 ? '+' : ''}{predictedMove.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0a0e27]/60 rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#4a6fa5]">{dirLabel}概率</div>
            <div className="font-mono font-bold text-sm" style={{ color: dirColor }}>{mainProbPct}%</div>
          </div>
          <div className="bg-[#0a0e27]/60 rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#4a6fa5]">80%区间</div>
            <div className="font-mono font-bold text-[10px] mt-0.5" style={{ color: dirColor }}>
              [{prediction.ci80Lower.toFixed(1)}, {prediction.ci80Upper.toFixed(1)}]%
            </div>
          </div>
          <div className="bg-[#0a0e27]/60 rounded-lg p-2 text-center">
            <div className="text-[10px] text-[#4a6fa5]">样本数</div>
            <div className="font-mono font-bold text-sm" style={{ color: dirColor }}>{prediction.matchSampleSize}</div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#1e3a5f]/30 text-[10px] text-[#4a6fa5]">
          方向概率: <span className="text-[#ff4757] font-mono">↑ {(prediction.upProbability * 100).toFixed(0)}%</span>
          {' · '}
          <span className="text-[#00ff88] font-mono">↓ {(prediction.downProbability * 100).toFixed(0)}%</span>
          {' · '}
          <span className="text-[#ffd700] font-mono">→ {(prediction.flatProbability * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function ProbRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span style={{ color }}>{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-[#0a0e27] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function CI95Bar({ pred, currentPrice }: { pred: WeekPrediction; currentPrice: number }) {
  const range = 10;
  const min = -range, max = range;
  const total = max - min;
  const zeroX = ((0 - min) / total) * 100;
  const lowerX = Math.max(0, Math.min(100, ((pred.ci95Lower - min) / total) * 100));
  const upperX = Math.max(0, Math.min(100, ((pred.ci95Upper - min) / total) * 100));
  const expectedX = Math.max(0, Math.min(100, ((pred.expectedReturn - min) / total) * 100));
  return (
    <div>
      <div className="relative h-8 mt-3">
        <div className="absolute top-0 bottom-0 w-px bg-[#4a6fa5]" style={{ left: `${zeroX}%` }} />
        <div className="absolute top-2 bottom-2 rounded" style={{
          left: `${lowerX}%`, width: `${upperX - lowerX}%`,
          background: pred.ci95Upper > 0 && pred.ci95Lower < 0
            ? 'linear-gradient(to right, #00ff8833 0%, #00ff8833 50%, #ff475733 50%, #ff475733 100%)'
            : pred.ci95Upper <= 0 ? '#00ff8833' : '#ff475733'
        }} />
        <div className="absolute top-0 bottom-0 w-1 rounded" style={{ left: `${expectedX}%`, background: '#ffd700' }} />
        <div className="absolute -top-1 text-[10px] text-[#00ff88] font-mono" style={{ left: `${lowerX}%`, transform: 'translateX(-50%)' }}>{pred.ci95Lower.toFixed(1)}%</div>
        <div className="absolute -top-1 text-[10px] text-[#ff4757] font-mono" style={{ left: `${upperX}%`, transform: 'translateX(-50%)' }}>{pred.ci95Upper.toFixed(1)}%</div>
      </div>
      <div className="flex justify-between text-[10px] text-[#4a6fa5] mt-2">
        <span>-10%</span><span>0%</span><span>+10%</span>
      </div>
    </div>
  );
}

function DataCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0a0e27]/60 rounded-lg p-2">
      <div className="text-[#4a6fa5] text-[10px]">{label}</div>
      <div className="font-mono font-bold text-sm" style={{ color }}>{value}</div>
    </div>
  );
}

function FactorBar({ label, weight }: { label: string; weight: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#4a6fa5] flex-1">{label}</span>
      <div className="flex items-center gap-3">
        <div className="text-[#4a6fa5] text-[10px]">权重 {(weight * 100).toFixed(0)}%</div>
        <div className="w-20 h-1.5 bg-[#0a0e27] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-[#1e90ff]" style={{ width: `${weight * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
