const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`, // service role para leer coordinador
    'Content-Type': 'application/json'
  };

  // Buscar el user_id del coordinador
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?rol=eq.coordinador&select=id,alias,email&limit=1`,
    { headers }
  );
  const profiles = await profileRes.json();
  if (!profiles?.length) return res.status(200).json({ positions: [], coordinator: { name: 'Coordinador' } });

  const coordinator = profiles[0];

  // Traer sus posiciones
  const posRes = await fetch(
    `${SUPABASE_URL}/rest/v1/positions?user_id=eq.${coordinator.id}&order=created_at.asc`,
    { headers }
  );
  const positions = await posRes.json();

  return res.status(200).json({
    coordinator: { name: coordinator.alias || coordinator.email },
    positions: positions || []
  });
}
