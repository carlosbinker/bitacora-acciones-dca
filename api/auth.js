const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, email, password } = req.body;
  const base = `${SUPABASE_URL}/auth/v1`;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY
  };

  if (action === 'register') {
    const r = await fetch(`${base}/signup`, {
      method: 'POST', headers,
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message || data.msg });
    return res.status(200).json({ user: data.user, token: data.access_token });
  }

  if (action === 'login') {
    const r = await fetch(`${base}/token?grant_type=password`, {
      method: 'POST', headers,
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (data.error || data.error_code) {
      return res.status(400).json({ error: 'Email o contraseña incorrectos' });
    }
    if (!data.access_token) {
      return res.status(400).json({ error: 'Email o contraseña incorrectos' });
    }
    return res.status(200).json({ user: data.user, token: data.access_token });
  }

  return res.status(400).json({ error: 'Acción no válida' });
}
