import { useState, useEffect, useCallback } from 'react';
import { ref, set, push, remove, onValue, type Database } from 'firebase/database';
import { db } from '@/lib/firebase';

export interface Holding {
  id: string;
  code: string;
  name: string;
  shares: number;
  costPrice: number;
  buyDate: string;
}

export function useHoldings(userId: string | null) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setHoldings([]);
      return;
    }

    setLoading(true);
    const holdingsRef = ref(db, `users/${userId}/holdings`);

    const unsub = onValue(holdingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: Holding[] = Object.entries(data).map(([key, val]: [string, any]) => ({
          id: key,
          code: val.code,
          name: val.name,
          shares: val.shares,
          costPrice: val.costPrice,
          buyDate: val.buyDate,
        }));
        setHoldings(list);
      } else {
        setHoldings([]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  const addHolding = useCallback(async (holding: Omit<Holding, 'id'>) => {
    if (!userId) return;
    const holdingsRef = ref(db, `users/${userId}/holdings`);
    const newRef = push(holdingsRef);
    await set(newRef, holding);
  }, [userId]);

  const removeHolding = useCallback(async (holdingId: string) => {
    if (!userId) return;
    const holdingRef = ref(db, `users/${userId}/holdings/${holdingId}`);
    await remove(holdingRef);
  }, [userId]);

  const updateHolding = useCallback(async (holding: Holding) => {
    if (!userId) return;
    const holdingRef = ref(db, `users/${userId}/holdings/${holding.id}`);
    await set(holdingRef, {
      code: holding.code,
      name: holding.name,
      shares: holding.shares,
      costPrice: holding.costPrice,
      buyDate: holding.buyDate,
    });
  }, [userId]);

  return { holdings, loading, addHolding, removeHolding, updateHolding };
}
