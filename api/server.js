import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 代码前缀转换：支持A股+基金
// 沪市：6开头(股票)、5开头(ETF/基金)、518/519(基金)
// 深市：0/3开头(股票)、15/16/18开头(ETF/基金)
function prefixCode(code) {
  if (code.startsWith('6') || code.startsWith('5')) return `sh${code}`;
  if (code.startsWith('0') || code.startsWith('1') || code.startsWith('3')) return `sz${code}`;
  return `sh${code}`;
}

// 判断品种类型
function getInstrumentType(code) {
  if (/^510|^511|^512|^513|^514|^515|^516|^517|^518|^519/.test(code)) return 'etf';
  if (/^159|^161|^162|^163|^164|^165|^166|^167|^168/.test(code)) return 'etf';
  if (/^501|^502/.test(code)) return 'lof';
  if (/^160|^170/.test(code)) return 'lof';
  return 'stock';
}

// 腾讯实时行情接口
app.get('/api/quote', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: '缺少code参数' });

    const prefixed = prefixCode(code);
    const url = `https://qt.gtimg.cn/q=${prefixed}`;
    const resp = await fetch(url, {
      headers: { 'Referer': 'https://finance.qq.com' },
    });
    const text = await resp.text();

    // 解析腾讯行情数据
    const lines = text.split(';').filter(l => l.trim());
    const result = {};

    for (const line of lines) {
      const match = line.match(/v_(\w+)="(.+)"/);
      if (!match) continue;
      const [, symbol, data] = match;
      const fields = data.split('~');

      if (fields.length > 30) {
        result[symbol] = {
          code: fields[2],
          name: fields[1],
          price: parseFloat(fields[3]),
          lastClose: parseFloat(fields[4]),
          open: parseFloat(fields[5]),
          volume: parseInt(fields[6]),
          high: parseFloat(fields[33]) || parseFloat(fields[5]),
          low: parseFloat(fields[34]) || parseFloat(fields[5]),
          amount: parseFloat(fields[37]),
          change: parseFloat(fields[31]),
          changePercent: parseFloat(fields[32]),
          time: fields[30],
        };
      }
    }

    res.json(result);
  } catch (err) {
    console.error('行情接口错误:', err.message);
    res.status(500).json({ error: '获取行情数据失败' });
  }
});

// 新浪实时行情（备用）
app.get('/api/quote-sina', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: '缺少code参数' });

    const prefixed = prefixCode(code);
    const url = `https://hq.sinajs.cn/list=${prefixed}`;
    const resp = await fetch(url, {
      headers: { 'Referer': 'https://finance.sina.com.cn' },
    });
    const text = await resp.text();

    const match = text.match(/="(.+)"/);
    if (!match) return res.json({});

    const fields = match[1].split(',');
    if (fields.length < 32) return res.json({});

    res.json({
      name: fields[0],
      open: parseFloat(fields[1]),
      lastClose: parseFloat(fields[2]),
      price: parseFloat(fields[3]),
      high: parseFloat(fields[4]),
      low: parseFloat(fields[5]),
      volume: parseInt(fields[8]),
      amount: parseFloat(fields[9]),
      date: fields[30],
      time: fields[31],
    });
  } catch (err) {
    console.error('新浪行情接口错误:', err.message);
    res.status(500).json({ error: '获取行情数据失败' });
  }
});

// 腾讯日K线历史数据
app.get('/api/kline', async (req, res) => {
  try {
    const { code, count = '250' } = req.query;
    if (!code) return res.status(400).json({ error: '缺少code参数' });

    const prefixed = prefixCode(code);
    // 腾讯日K线接口
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefixed},day,,,${count},qfq`;
    const resp = await fetch(url);
    const data = await resp.json();

    const codeData = data?.data?.[prefixed];
    if (!codeData) return res.json({ bars: [] });

    const dayData = codeData?.qfqday || codeData?.day || [];
    const bars = dayData.map(d => ({
      date: d[0],
      open: parseFloat(d[1]),
      high: parseFloat(d[3]),
      low: parseFloat(d[4]),
      close: parseFloat(d[2]),
      volume: parseInt(d[5]) || 0,
    }));

    // 获取股票名称
    const name = codeData?.qt?.[prefixed]?.[1] || code;

    // 品种类型
    const type = getInstrumentType(String(code));

    res.json({ bars, name, type });
  } catch (err) {
    console.error('K线接口错误:', err.message);
    res.status(500).json({ error: '获取K线数据失败' });
  }
});

// 股票搜索（本地匹配 + 腾讯搜索建议）
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    // 腾讯搜索建议API
    const url = `https://smartbox.gtimg.cn/s3/?q=${encodeURIComponent(q)}&t=all`;
    const resp = await fetch(url);
    const text = await resp.text();

    // 解析格式：v_hint="market~code~name~pinyin~type^..."
    const results = [];
    const hintMatch = text.match(/v_hint="(.+)"/);
    if (hintMatch) {
      const entries = hintMatch[1].split('^');
      for (const entry of entries) {
        const parts = entry.split('~');
        if (parts.length >= 5) {
          const market = parts[0]; // sh/sz
          const code = parts[1];
          const name = parts[2];
          const type = parts[4];
          // 返回A股和基金
          const allowedTypes = ['GP-A', 'JJ', 'ETF', 'LOF', 'QDII', 'QDII-ETF', 'QDII-LOF', 'FB', 'QDII-FB'];
          const typeMatch = allowedTypes.some(t => type === t || type.startsWith('QDII'));
          if (typeMatch) {
            // 映射腾讯类型到统一类型
            let instrumentType = 'stock';
            if (type === 'ETF' || type === 'JJ' || type === 'QDII-ETF') instrumentType = 'etf';
            if (type === 'LOF' || type === 'FB' || type === 'QDII-LOF') instrumentType = 'lof';
            if (type === 'QDII' || type === 'QDII-FB') instrumentType = 'qdii';
            // 用代码判断更精确
            if (code) instrumentType = getInstrumentType(code);
            results.push({ code, name, type: instrumentType, rawType: type });
          }
        }
      }
    }

    res.json(results.slice(0, 10));
  } catch (err) {
    console.error('搜索接口错误:', err.message);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 大盘热度接口（上证指数+深证成指）
app.get('/api/market-heat', async (req, res) => {
  try {
    // 同时请求上证指数和深证成指的实时数据
    const url = `https://qt.gtimg.cn/q=sh000001,sz399001`;
    const resp = await fetch(url, {
      headers: { 'Referer': 'https://finance.qq.com' },
    });
    const text = await resp.text();

    let shChange = 0, szChange = 0, shVol = 0, szVol = 0;
    const lines = text.split(';').filter(l => l.trim());

    for (const line of lines) {
      const match = line.match(/v_(\w+)="(.+)"/);
      if (!match) continue;
      const [, symbol, data] = match;
      const fields = data.split('~');
      if (fields.length > 37) {
        if (symbol.startsWith('sh')) {
          shChange = parseFloat(fields[32]) || 0;
          shVol = parseInt(fields[6]) || 0;
        } else {
          szChange = parseFloat(fields[32]) || 0;
          szVol = parseInt(fields[6]) || 0;
        }
      }
    }

    // 获取上证指数近20日K线用于趋势判断
    const shKlineUrl = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000001,day,,,20,qfq`;
    const shResp = await fetch(shKlineUrl);
    const shData = await shResp.json();
    const shBars = shData?.data?.sh000001?.day || [];

    // 计算大盘热度 (0-100)
    let heat = 50;

    // 1. 指数涨跌幅贡献 (-20 ~ +20)
    heat += (shChange + szChange) * 5;

    // 2. 短期趋势（近5日均线方向）(-15 ~ +15)
    if (shBars.length >= 5) {
      const recent = shBars.slice(-5);
      const closes = recent.map(b => parseFloat(b[2]));
      if (closes[4] > closes[0]) heat += 15;
      else heat -= 15;
    }

    // 3. 量能变化 (-15 ~ +15)
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

    res.json({
      heat,
      shChange: parseFloat(shChange.toFixed(2)),
      szChange: parseFloat(szChange.toFixed(2)),
      label: heat > 65 ? '火热' : heat > 55 ? '偏暖' : heat > 45 ? '温和' : heat > 35 ? '偏冷' : '冰点',
    });
  } catch (err) {
    console.error('大盘热度接口错误:', err.message);
    res.json({ heat: 50, shChange: 0, szChange: 0, label: '温和' });
  }
});

app.listen(PORT, () => {
  console.log(`A股数据代理服务器运行在 http://localhost:${PORT}`);
});
