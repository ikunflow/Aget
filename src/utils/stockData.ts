import type { Stock, DailyBar } from './types';

// 50只热门A股
export const STOCK_LIST: Stock[] = [
  { code: '600519', name: '贵州茅台', industry: '白酒' },
  { code: '000858', name: '五粮液', industry: '白酒' },
  { code: '601318', name: '中国平安', industry: '保险' },
  { code: '600036', name: '招商银行', industry: '银行' },
  { code: '000333', name: '美的集团', industry: '家电' },
  { code: '600276', name: '恒瑞医药', industry: '医药' },
  { code: '601166', name: '兴业银行', industry: '银行' },
  { code: '000651', name: '格力电器', industry: '家电' },
  { code: '601888', name: '中国中免', industry: '旅游' },
  { code: '600900', name: '长江电力', industry: '电力' },
  { code: '000001', name: '平安银行', industry: '银行' },
  { code: '600000', name: '浦发银行', industry: '银行' },
  { code: '601398', name: '工商银行', industry: '银行' },
  { code: '600030', name: '中信证券', industry: '券商' },
  { code: '601939', name: '建设银行', industry: '银行' },
  { code: '000002', name: '万科A', industry: '房地产' },
  { code: '600809', name: '山西汾酒', industry: '白酒' },
  { code: '002475', name: '立讯精密', industry: '电子' },
  { code: '300750', name: '宁德时代', industry: '新能源' },
  { code: '601012', name: '隆基绿能', industry: '新能源' },
  { code: '600887', name: '伊利股份', industry: '乳业' },
  { code: '002714', name: '牧原股份', industry: '养殖' },
  { code: '601899', name: '紫金矿业', industry: '有色' },
  { code: '600585', name: '海螺水泥', industry: '建材' },
  { code: '002352', name: '顺丰控股', industry: '物流' },
  { code: '600309', name: '万华化学', industry: '化工' },
  { code: '601088', name: '中国神华', industry: '煤炭' },
  { code: '600104', name: '上汽集团', industry: '汽车' },
  { code: '002415', name: '海康威视', industry: '安防' },
  { code: '000568', name: '泸州老窖', industry: '白酒' },
  { code: '601628', name: '中国人寿', industry: '保险' },
  { code: '600690', name: '海尔智家', industry: '家电' },
  { code: '002304', name: '洋河股份', industry: '白酒' },
  { code: '600196', name: '复星医药', industry: '医药' },
  { code: '601668', name: '中国建筑', industry: '建筑' },
  { code: '600048', name: '保利发展', industry: '房地产' },
  { code: '000596', name: '古井贡酒', industry: '白酒' },
  { code: '603259', name: '药明康德', industry: '医药' },
  { code: '600570', name: '恒生电子', industry: '金融IT' },
  { code: '002230', name: '科大讯飞', industry: 'AI' },
  { code: '688981', name: '中芯国际', industry: '半导体' },
  { code: '603288', name: '海天味业', industry: '调味品' },
  { code: '002241', name: '歌尔股份', industry: '电子' },
  { code: '000625', name: '长安汽车', industry: '汽车' },
  { code: '601728', name: '中国电信', industry: '通信' },
  { code: '600941', name: '中国移动', industry: '通信' },
  { code: '601857', name: '中国石油', industry: '石油' },
  { code: '600028', name: '中国石化', industry: '石油' },
  { code: '600050', name: '中国联通', industry: '通信' },
  { code: '002594', name: '比亚迪', industry: '新能源车' },
];

// 热门场内基金（ETF/LOF）
export const FUND_LIST: Stock[] = [
  { code: '510050', name: '50ETF', industry: '宽基', type: 'etf' },
  { code: '510300', name: '沪深300ETF', industry: '宽基', type: 'etf' },
  { code: '510500', name: '中证500ETF', industry: '宽基', type: 'etf' },
  { code: '159919', name: '300ETF', industry: '宽基', type: 'etf' },
  { code: '159915', name: '创业板ETF', industry: '宽基', type: 'etf' },
  { code: '588000', name: '科创50ETF', industry: '宽基', type: 'etf' },
  { code: '512100', name: '中证1000ETF', industry: '宽基', type: 'etf' },
  { code: '510880', name: '红利ETF', industry: '策略', type: 'etf' },
  { code: '512690', name: '酒ETF', industry: '消费', type: 'etf' },
  { code: '512010', name: '医药ETF', industry: '医药', type: 'etf' },
  { code: '512660', name: '军工ETF', industry: '军工', type: 'etf' },
  { code: '512480', name: '半导体ETF', industry: '科技', type: 'etf' },
  { code: '515030', name: '新能源车ETF', industry: '新能源', type: 'etf' },
  { code: '512200', name: '房地产ETF', industry: '房地产', type: 'etf' },
  { code: '513100', name: '纳指ETF', industry: '跨境', type: 'qdii' },
  { code: '513500', name: '标普500ETF', industry: '跨境', type: 'qdii' },
  { code: '518880', name: '黄金ETF', industry: '商品', type: 'etf' },
  { code: '162411', name: '华宝油气', industry: '商品', type: 'lof' },
  { code: '164906', name: '交银中证海外中国互联网', industry: '跨境', type: 'lof' },
  { code: '501050', name: '上证50ETF基金', industry: '宽基', type: 'lof' },
];

// 合并列表
export const ALL_LIST: Stock[] = [...STOCK_LIST, ...FUND_LIST];

// 基于种子生成伪随机数
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

// 根据股票代码生成种子
function codeToSeed(code: string): number {
  let seed = 0;
  for (let i = 0; i < code.length; i++) {
    seed = seed * 31 + code.charCodeAt(i);
  }
  return seed;
}

// 基于几何布朗运动模拟A股/基金数据
export function generateStockData(code: string): DailyBar[] {
  const item = ALL_LIST.find(s => s.code === code);
  if (!item) return [];

  const seed = codeToSeed(code);
  const rand = seededRandom(seed);

  const isFund = item.type === 'etf' || item.type === 'lof' || item.type === 'qdii';

  // 根据行业设置不同基准价格和波动率
  const priceMap: Record<string, number> = {
    '白酒': 180, '保险': 50, '银行': 15, '家电': 55,
    '医药': 35, '旅游': 80, '电力': 22, '券商': 20,
    '房地产': 12, '电子': 38, '新能源': 200, '乳业': 30,
    '养殖': 45, '有色': 14, '建材': 35, '物流': 40,
    '化工': 80, '煤炭': 25, '汽车': 18, '安防': 30,
    '金融IT': 45, 'AI': 55, '半导体': 50, '调味品': 75,
    '通信': 6, '石油': 7, '新能源车': 250,
    '宽基': 4, '策略': 3, '消费': 2.5, '军工': 1.2,
    '科技': 1.5, '跨境': 1.8, '商品': 5,
  };

  const basePrice = priceMap[item.industry] || 30;
  // 基金波动率通常低于个股
  const volatility = isFund
    ? 0.012 + rand() * 0.008  // 1.2%-2%
    : 0.025 + rand() * 0.015; // 2.5%-4%
  const drift = (rand() - 0.45) * 0.001;

  const bars: DailyBar[] = [];
  let price = basePrice;

  const startDate = new Date('2024-07-01');
  let tradingDay = 0;

  for (let i = 0; i < 350 && tradingDay < 240; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    const z = (rand() + rand() + rand() - 1.5) * 1.2;
    const dailyReturn = drift + volatility * z;

    const open = price;
    const closeRaw = open * (1 + dailyReturn);

    // A股涨跌停限制：股票±10%，ETF±10%，部分基金±10%
    const limitPct = isFund ? 0.1 : 0.1;
    const maxUp = open * (1 + limitPct);
    const maxDown = open * (1 - limitPct);
    const close = Math.max(maxDown, Math.min(maxUp, closeRaw));

    const intraVol = volatility * 0.6;
    const high = Math.max(open, close) * (1 + rand() * intraVol);
    const low = Math.min(open, close) * (1 - rand() * intraVol);

    // 基金成交量通常较小
    const baseVol = isFund
      ? 20000 + rand() * 80000
      : 50000 + rand() * 200000;
    const volMultiplier = 1 + Math.abs(dailyReturn) * 10;
    const volume = Math.round(baseVol * volMultiplier);

    const dateStr = date.toISOString().slice(0, 10);

    bars.push({
      stockCode: code,
      date: dateStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    });

    price = close;
    tradingDay++;
  }

  return bars;
}

export function searchStocks(query: string): Stock[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return ALL_LIST.filter(
    s => s.code.includes(q) || s.name.toLowerCase().includes(q)
  ).slice(0, 10);
}
