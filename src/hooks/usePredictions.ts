import { useState, useEffect, useCallback } from 'react';
import { ref, set, remove, query, orderByChild, equalTo, get, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { fetchKline } from '@/utils/api';
import type { HourPrediction } from '@/utils/hourPredictor';

// 预测记录(写入数据库) - 支持未来3天
export interface PredictionRecord {
  id: string;
  code: string;
  name: string;
  predictedAt: number;      // 预测时间戳(ms)
  baseDate: string;          // 基于哪一天的K线预测(YYYY-MM-DD)
  basePrice: number;         // 预测时的现价
  // 多日预测:daysAhead=1/2/3(明日/后日/大后日)
  daysAhead: number;         // 预测未来第几天(1=明日, 2=后日, 3=大后日)
  targetDate: string;        // 目标预测日(数据库后填 = baseDate后第N个交易日)
  predictedClose: number;    // 预测的N日后收盘价
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
          daysAhead: val.daysAhead ?? 1,        // 兼容旧记录(无 daysAhead 字段)
          targetDate: val.targetDate ?? val.baseDate,  // 兼容旧记录
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

  // 保存未来多天(1/2/3日)预测到数据库
  // daysPreds: [{ daysAhead, targetDate, predictedClose, predictedChange, direction, score, confidence }]
  const savePrediction = useCallback(async (
    daysPreds: { daysAhead: number; targetDate: string; pred: any }[],
    code: string,
    name: string,
    baseDate: string,
    basePrice: number
  ) => {
    if (!userId) return;
    const now = Date.now();
    for (const { daysAhead, targetDate, pred } of daysPreds) {
      // 幂等键:同一只股票同一天+同一daysAhead 只保留一条
      const idKey = `${code}_${baseDate}_d${daysAhead}`;
      const predRef = ref(db, `users/${userId}/predictions/${idKey}`);
      const record: PredictionRecord = {
        id: idKey,
        code,
        name,
        predictedAt: now,
        baseDate,
        basePrice,
        daysAhead,
        targetDate,
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
    }
  }, [userId]);

  // 拉取指定股票某天的实际收盘价,并回填数据库
  // daysAhead=1 用 baseDate 之后第1个交易日, =2 用第2个, =3 用第3个
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

        for (const r of recs) {
          // 找到 baseDate 当天及之后最近一个交易日的K线
          const baseIdx = klineData.bars.findIndex(b => b.date >= r.baseDate);
          if (baseIdx < 0) continue;
          const baseBar = klineData.bars[baseIdx];
          // 找 baseDate 之后第 daysAhead 个交易日
          const targetIdx = baseIdx + (r.daysAhead || 1);
          // 还没到时间就跳过
          if (targetIdx >= klineData.bars.length) continue;
          const targetBar = klineData.bars[targetIdx];
          const actualClose = targetBar.close;
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

  // 清理超过 maxAgeDays 天的已回填记录
  const clearOldRecords = useCallback(async (maxAgeDays: number = 30) => {
    if (!userId) return;
    const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
    const toDelete = records.filter(r => r.resolved && r.predictedAt < cutoff);
    for (const r of toDelete) {
      const predRef = ref(db, `users/${userId}/predictions/${r.id}`);
      await remove(predRef);
    }
    return toDelete.length;
  }, [userId, records]);

  // 清空全部预测记录
  const clearAllRecords = useCallback(async () => {
    if (!userId) return;
    const predRef = ref(db, `users/${userId}/predictions`);
    await remove(predRef);
  }, [userId]);

  // 删除单条记录
  const deleteRecord = useCallback(async (recordId: string) => {
    if (!userId) return;
    const predRef = ref(db, `users/${userId}/predictions/${recordId}`);
    await remove(predRef);
  }, [userId]);

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

  return { records, loading, savePrediction, resolvePending, clearOldRecords, clearAllRecords, deleteRecord, stats };
}
