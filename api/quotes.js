export default async function handler(req, res) {
  const { symbols } = req.query;

  const allowed = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin) || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!symbols) return res.status(400).json({ error: 'symbols parameter required' });

  const tickers = symbols.split(',').map(s => s.trim()).filter(Boolean);
  const results = [];

  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://finance.yahoo.com/',
          'Origin': 'https://finance.yahoo.com',
        }
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        results.push({
          symbol: ticker.toUpperCase(),
          regularMarketPrice: meta.regularMarketPrice,
          regularMarketChangePercent: meta.regularMarketChangePercent ?? null,
        });
      }
    } catch (e) {
      console.error(`Error fetching ${ticker}:`, e.message);
    }
  }

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({
    quoteResponse: { result: results, error: null }
  });
}
