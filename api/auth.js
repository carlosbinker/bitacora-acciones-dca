const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, email, password, alias } = req.body;
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
    if (data.error || data.error_code) {
      return res.status(400).json({ error: 'El email ya está registrado o es inválido' });
    }
    if (!data.access_token) {
      return res.status(400).json({ error: 'No se pudo completar el registro' });
    }
    // Guardar alias en profiles si se proporcionó
    if (alias && alias.trim() && data.user?.id) {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${data.access_token}`
        },
        body: JSON.stringify({ alias: alias.trim() })
      });
    }
    return res.status(200).json({ user: data.user, token: data.access_token, alias: alias?.trim() || null });
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
    // Buscar alias del usuario
    let alias = null;
    if (data.user?.id) {
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${data.user.id}&select=alias`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${data.access_token}` }
      });
      const profile = await pr.json();
      alias = profile?.[0]?.alias || null;
    }
    return res.status(200).json({ user: data.user, token: data.access_token, alias });
  }

  return res.status(400).json({ error: 'Acción no válida' });
}
