import { useState, useEffect, useCallback } from 'react';
import { ref, set, query, orderByChild, equalTo, get, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { fetchKline } from '@/utils/api';
import type { HourPrediction } from '@/utils/hourPredictor';

// 预测记录(写入数据库)
export interface PredictionRecord {
  id: string;
  code: string;
  name: string;
  predictedAt: number;      // 预测时间戳(ms)
  baseDate: string;          // 基于哪一天的K线预测(YYYY-MM-DD)
  basePrice: number;         // 预测时的现价
  predictedClose: number;    // 1小时预测价
  predictedChange: number;   // 预测涨跌幅(%)
  direction: 'up' | 'down' | 'flat';
  score: number;
  confidence: number;
  // 对比结果(由系统回填)
  actualClose: number | null;   // 实际收盘价
  actualChange: number | null;  // 实际涨跌幅(%)
  isCorrect: boolean | null;    // 方向是否预测正确
  resolved: boolean;            // 是否已经回填实际价
}

export function usePredictions(userId: string | null) {
  const [records, setRecords] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载用户的所有预测记录
  useEffect(() => {
    if (!userId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    const predRef = ref(db, `users/${userId}/predictions`);
    const unsub = onValue(predRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: PredictionRecord[] = Object.entries(data).map(([key, val]: [string, any]) => ({
          id: key,
          code: val.code,
          name: val.name,
          predictedAt: val.predictedAt,
          baseDate: val.baseDate,
          basePrice: val.basePrice,
          predictedClose: val.predictedClose,
          predictedChange: val.predictedChange,
          direction: val.direction,
          score: val.score,
          confidence: val.confidence,
          actualClose: val.actualClose ?? null,
          actualChange: val.actualChange ?? null,
          isCorrect: val.isCorrect ?? null,
          resolved: val.resolved ?? false,
        }));
        // 按时间倒序
        list.sort((a, b) => b.predictedAt - a.predictedAt);
        setRecords(list);
      } else {
        setRecords([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  // 保存新预测到数据库(使用 baseDate+code+predictedAt 作为幂等键避免重复)
  const savePrediction = useCallback(async (
    pred: any,
    code: string,
    name: string,
    baseDate: string,
    basePrice: number
  ) => {
    if (!userId) return;
    // 幂等键:同一只股票同一天只保留一条预测快照
    const idKey = `${code}_${baseDate}`;
    const predRef = ref(db, `users/${userId}/predictions/${idKey}`);
    const record = {
      code,
      name,
      predictedAt: Date.now(),
      baseDate,
      basePrice,
      predictedClose: pred.predictedClose,
      predictedChange: pred.expectedChange,
      direction: pred.direction,
      score: pred.score,
      confidence: pred.confidence,
      actualClose: null,
      actualChange: null,
      isCorrect: null,
      resolved: false,
    };
    await set(predRef, record);
  }, [userId]);

  // 拉取指定股票某天的实际收盘价,并回填数据库
  // 用于"已过完的预测日":baseDate 那天之后的实际收盘价才能对比
  // 由于小时级预测的方向是基于"未来1小时",我们用下一交易日的开盘价作为实际方向基准
  // (或者用当天K线最后5分钟的均价,这里简化为:以"实际方向"为参考)
  const resolvePending = useCallback(async () => {
    if (!userId) return;
    const pending = records.filter(r => !r.resolved);
    if (pending.length === 0) return;

    // 按股票代码分组(一次拉取该股票最近30个交易日K线)
    const byCode = new Map<string, PredictionRecord[]>();
    for (const r of pending) {
      if (!byCode.has(r.code)) byCode.set(r.code, []);
      byCode.get(r.code)!.push(r);
    }

    for (const [code, recs] of byCode) {
      try {
        const klineData = await fetchKline(code, 60);
        if (klineData.bars.length === 0) continue;
        // 构造 date->close 的映射
        const closeMap = new Map<string, number>();
        for (const b of klineData.bars) closeMap.set(b.date, b.close);

        for (const r of recs) {
          // 找到 baseDate 当天及之后最近一个交易日的K线
          const baseIdx = klineData.bars.findIndex(b => b.date >= r.baseDate);
          if (baseIdx < 0) continue;
          const baseBar = klineData.bars[baseIdx];
          // 找 baseDate 之后最近一个交易日的收盘价(代表"未来"实际价)
          // 即使 baseIdx 是最后一天,实际是明天才开盘,我们也不能用今天之后的数据(还没有),跳过
          if (baseIdx >= klineData.bars.length - 1) continue;
          const nextBar = klineData.bars[baseIdx + 1];
          const actualClose = nextBar.close;
          const actualChange = (actualClose - baseBar.close) / baseBar.close * 100;

          // 方向对比
          let actualDir: 'up' | 'down' | 'flat' = 'flat';
          if (actualChange > 0.1) actualDir = 'up';
          else if (actualChange < -0.1) actualDir = 'down';

          // 方向是否预测正确(flat时不算命中也不算miss)
          const isCorrect = r.direction === 'flat'
            ? null
            : r.direction === actualDir;

          const predRef = ref(db, `users/${userId}/predictions/${r.id}`);
          await set(predRef, {
            ...r,
            actualClose,
            actualChange: parseFloat(actualChange.toFixed(2)),
            isCorrect,
            resolved: true,
          });
        }
      } catch (e) {
        console.warn(`回填 ${code} 失败:`, e);
      }
    }
  }, [userId, records]);

  // 准确率统计
  const stats = {
    total: records.length,
    resolved: records.filter(r => r.resolved).length,
    correct: records.filter(r => r.isCorrect === true).length,
    incorrect: records.filter(r => r.isCorrect === false).length,
    accuracy: (() => {
      const judged = records.filter(r => r.isCorrect === true || r.isCorrect === false);
      if (judged.length === 0) return null;
      return judged.filter(r => r.isCorrect).length / judged.length;
    })(),
    byCode: (() => {
      const m = new Map<string, { total: number; correct: number; accuracy: number }>();
      for (const r of records) {
        if (r.isCorrect !== true && r.isCorrect !== false) continue;
        if (!m.has(r.code)) m.set(r.code, { total: 0, correct: 0, accuracy: 0 });
        const s = m.get(r.code)!;
        s.total++;
        if (r.isCorrect) s.correct++;
      }
      for (const s of m.values()) {
        s.accuracy = s.total > 0 ? s.correct / s.total : 0;
      }
      return m;
    })(),
  };

  return { records, loading, savePrediction, resolvePending, stats };
}
