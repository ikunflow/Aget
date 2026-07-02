import type { DailyBar, InstrumentType } from './types';

// 代码前缀转换
function prefixCode(code: string): string {
  if (code.startsWith('6') || code.startsWith('5')) return `sh${code}`;
  if (code.startsWith('0') || code.startsWith('1') || code.startsWith('3')) return `sz${code}`;
  return `sh${code}`;
}

// 判断品种类型
export function getInstrumentType(code: string): InstrumentType {
  if (/^510|^511|^512|^513|^514|^515|^516|^517|^518|^519/.test(code)) return 'etf';
  if (/^159|^161|^162|^163|^164|^165|^166|^167|^168/.test(code)) return 'etf';
  if (/^501|^502/.test(code)) return 'lof';
  if (/^160|^170/.test(code)) return 'lof';
  return 'stock';
}

// 腾讯K线API（支持CORS）
export async function fetchKline(code: string, count: number = 730): Promise<{ bars: DailyBar[]; name: string; type: InstrumentType }> {
  const prefixed = prefixCode(code);
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefixed},day,,,${count},qfq`;
  const resp = await fetch(url);
  const data = await resp.json();

  const codeData = data?.data?.[prefixed];
  if (!codeData) return { bars: [], name: code, type: getInstrumentType(code) };

  const dayData = codeData?.qfqday || codeData?.day || [];
  const bars: DailyBar[] = dayData.map((d: string[]) => ({
    date: d[0],
    open: parseFloat(d[1]),
    high: parseFloat(d[3]),
    low: parseFloat(d[4]),
    close: parseFloat(d[2]),
    volume: parseInt(d[5]) || 0,
  }));

  const name = codeData?.qt?.[prefixed]?.[1] || code;
  const type = getInstrumentType(code);

  return { bars, name, type };
}

// 腾讯搜索API（通过script标签绕过CORS）
async function searchViaScriptTag(query: string): Promise<{ code: string; name: string; type?: string }[]> {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    const stamp = Date.now();

    const cleanup = () => {
      script.remove();
      // 清理全局变量
      try { delete (window as any).v_hint; } catch { (window as any).v_hint = undefined; }
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 5000);

    script.onload = () => {
      clearTimeout(timeout);
      const hintData = (window as any).v_hint || '';
      cleanup();

      const results: { code: string; name: string; type?: string }[] = [];
      if (!hintData) { resolve([]); return; }

      const entries = hintData.split('^');
      for (const entry of entries) {
        const parts = entry.split('~');
        if (parts.length >= 5) {
          const code = parts[1];
          const name = parts[2];
          const type = parts[4];
          const allowedTypes = ['GP-A', 'JJ', 'ETF', 'LOF', 'QDII', 'QDII-ETF', 'QDII-LOF', 'FB', 'QDII-FB'];
          const typeMatch = allowedTypes.some(t => type === t || type.startsWith('QDII'));
          if (typeMatch && code) {
            results.push({ code, name, type: getInstrumentType(code) });
          }
        }
      }
      resolve(results.slice(0, 10));
    };

    script.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve([]);
    };

    // 腾讯搜索建议API，返回 v_hint="..." 格式的JS代码
    script.src = `https://smartbox.gtimg.cn/s3/?q=${encodeURIComponent(query)}&t=all&_=${stamp}`;
    document.head.appendChild(script);
  });
}

// 通过K线API验证代码是否存在（K线API支持CORS）
async function searchByKline(code: string): Promise<{ code: string; name: string; type?: string } | null> {
  try {
    const data = await fetchKline(code, 5);
    if (data.bars.length > 0 && data.name && data.name !== code) {
      return { code, name: data.name, type: data.type };
    }
  } catch {}
  return null;
}

export async function searchStocksAPI(query: string): Promise<{ code: string; name: string; type?: string }[]> {
  // 1. 先尝试script标签搜索
  const scriptResults = await searchViaScriptTag(query);
  if (scriptResults.length > 0) return scriptResults;

  // 2. 搜索API失败时，如果输入是6位数字代码，直接用K线API验证
  const trimmed = query.trim();
  if (/^\d{6}$/.test(trimmed)) {
    const klineResult = await searchByKline(trimmed);
    if (klineResult) return [klineResult];
  }

  return [];
}

// 大盘热度（仅用K线API，避免CORS问题）
export async function fetchMarketHeat(): Promise<{ heat: number; label: string }> {
  try {
    // 上证指数K线
    const shResp = await fetch('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000001,day,,,20,qfq');
    const shData = await shResp.json();
    const shBars: string[][] = shData?.data?.sh000001?.day || [];

    // 深证成指K线
    const szResp = await fetch('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sz399001,day,,,5,qfq');
    const szData = await szResp.json();
    const szBars: string[][] = szData?.data?.sz399001?.day || [];

    let heat = 50;

    // 1. 上证近5日涨跌贡献
    if (shBars.length >= 5) {
      const recent = shBars.slice(-5);
      const change = (parseFloat(recent[4][2]) - parseFloat(recent[0][1])) / parseFloat(recent[0][1]) * 100;
      heat += change * 5;
    }

    // 2. 深证近5日涨跌贡献
    if (szBars.length >= 2) {
      const szChange = (parseFloat(szBars[szBars.length - 1][2]) - parseFloat(szBars[0][1])) / parseFloat(szBars[0][1]) * 100;
      heat += szChange * 3;
    }

    // 3. 短期趋势（近5日均线方向）
    if (shBars.length >= 5) {
      const recent = shBars.slice(-5);
      const closes = recent.map(b => parseFloat(b[2]));
      if (closes[4] > closes[0]) heat += 15;
      else heat -= 15;
    }

    // 4. 量能变化
    if (shBars.length >= 10) {
      const volRecent = shBars.slice(-5).reduce((s, b) => s + (parseInt(b[5]) || 0), 0) / 5;
      const volPrev = shBars.slice(-10, -5).reduce((s, b) => s + (parseInt(b[5]) || 0), 0) / 5;
      if (volPrev > 0) {
        const volRatio = volRecent / volPrev;
        if (volRatio > 1.3) heat += 15;
        else if (volRatio > 1.1) heat += 8;
        else if (volRatio < 0.7) heat -= 15;
        else if (volRatio < 0.9) heat -= 8;
      }
    }

    heat = Math.max(0, Math.min(100, Math.round(heat)));
    const label = heat > 65 ? '火热' : heat > 55 ? '偏暖' : heat > 45 ? '温和' : heat > 35 ? '偏冷' : '冰点';
    return { heat, label };
  } catch {
    return { heat: 50, label: '温和' };
  }
}
