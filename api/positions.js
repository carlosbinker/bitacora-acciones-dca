const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const base = `${SUPABASE_URL}/rest/v1/positions`;

  // Resuelve el user_id a partir del token (se reutiliza en GET, POST, PUT, DELETE)
  async function getUserId() {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${token}` }
    });
    const data = await r.json();
    return data?.id || null;
  }

  if (req.method === 'GET') {
    const userId = await getUserId();
    if (!userId) return res.status(401).json({ error: 'Token inválido' });
    const r = await fetch(`${base}?user_id=eq.${userId}&tipo=eq.personal&order=created_at.asc`, { headers });
    return res.status(200).json(await r.json());
  }

  if (req.method === 'POST') {
    const userId = await getUserId();
    if (!userId) return res.status(401).json({ error: 'Token inválido' });
    const body = { ...req.body, user_id: userId, tipo: 'personal' };
    const r = await fetch(base, { method: 'POST', headers, body: JSON.stringify(body) });
    return res.status(201).json(await r.json());
  }

  if (req.method === 'PUT') {
    const { id, ...body } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const userId = await getUserId();
    if (!userId) return res.status(401).json({ error: 'Token inválido' });
    // Filtra por user_id para que un usuario no pueda editar posiciones ajenas
    const r = await fetch(`${base}?id=eq.${id}&user_id=eq.${userId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ ...body, updated_at: new Date().toISOString() })
    });
    return res.status(200).json(await r.json());
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const userId = await getUserId();
    if (!userId) return res.status(401).json({ error: 'Token inválido' });
    // Filtra por user_id para que un usuario no pueda borrar posiciones ajenas
    await fetch(`${base}?id=eq.${id}&user_id=eq.${userId}`, { method: 'DELETE', headers });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
