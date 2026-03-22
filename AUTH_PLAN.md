# Plan de Autenticación — Portfolio Tracker
## Stack: Supabase Auth + Vercel + HTML/JS vanilla

---

## RESUMEN DEL MODELO

Cada usuario se registra con email y contraseña.
Al iniciar sesión, la app carga sus propias posiciones desde Supabase.
El coordinador (admin) tiene un portfolio "maestro" visible para todos como referencia.

---

## PASO 1 — Configurar Supabase Auth (en el dashboard)

### 1.1 Habilitar Email Auth
- Ir a: Authentication → Providers → Email
- Verificar que esté habilitado (toggle ON)
- Opción "Confirm email": podés dejarlo OFF para simplificar (sin verificación de email)

### 1.2 Modificar la tabla positions
Ejecutar en SQL Editor:

```sql
-- Agregar columna user_id como FK a auth.users
ALTER TABLE positions 
  DROP COLUMN user_id;

ALTER TABLE positions 
  ADD COLUMN user_id uuid references auth.users(id) on delete cascade;

-- Eliminar política anterior
DROP POLICY IF EXISTS "Users can manage their own positions" ON positions;

-- Nueva política: cada usuario solo ve y edita sus propias posiciones
CREATE POLICY "Users manage own positions"
ON positions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política especial: todos pueden VER las posiciones del coordinador (portfolio maestro)
-- Reemplazar 'EMAIL-DEL-COORDINADOR@gmail.com' con el email real
CREATE POLICY "Everyone can view master portfolio"
ON positions FOR SELECT
USING (
  user_id = (
    SELECT id FROM auth.users 
    WHERE email = 'EMAIL-DEL-COORDINADOR@gmail.com'
    LIMIT 1
  )
);
```

### 1.3 Crear tabla de perfiles (opcional pero recomendado)
```sql
CREATE TABLE profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  nombre text,
  rol text default 'usuario', -- 'usuario' o 'coordinador'
  created_at timestamp with time zone default now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

---

## PASO 2 — Actualizar variables de entorno en Vercel

No se necesitan cambios — ya tenés SUPABASE_URL y SUPABASE_ANON_KEY.

---

## PASO 3 — Nuevo archivo: api/auth.js

Este endpoint maneja login, registro y logout desde el frontend.

```javascript
// api/auth.js
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
    if (data.error) return res.status(400).json({ error: data.error_description || data.error });
    return res.status(200).json({ user: data.user, token: data.access_token });
  }

  return res.status(400).json({ error: 'Acción no válida' });
}
```

---

## PASO 4 — Actualizar api/positions.js

Cambiar autenticación de x-user-id custom a JWT de Supabase:

```javascript
// api/positions.js
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Tomar el JWT del header Authorization
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token}`, // JWT del usuario → RLS automático
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const base = `${SUPABASE_URL}/rest/v1/positions`;

  if (req.method === 'GET') {
    const r = await fetch(`${base}?order=created_at.asc`, { headers });
    return res.status(200).json(await r.json());
  }

  if (req.method === 'POST') {
    const r = await fetch(base, { method: 'POST', headers, body: JSON.stringify(req.body) });
    return res.status(201).json(await r.json());
  }

  if (req.method === 'PUT') {
    const { id, ...body } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await fetch(`${base}?id=eq.${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ ...body, updated_at: new Date().toISOString() })
    });
    return res.status(200).json(await r.json());
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    await fetch(`${base}?id=eq.${id}`, { method: 'DELETE', headers });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
```

---

## PASO 5 — Actualizar index.html

### 5.1 Agregar pantalla de login/registro
Antes del `<div class="app">` agregar un modal de auth:

```html
<!-- Auth Modal -->
<div class="auth-overlay" id="auth-overlay">
  <div class="auth-box">
    <img src="[LOGO-BASE64]" style="width:80px;margin-bottom:16px;">
    <h2>RETO 2026</h2>
    <p>Inversiones en el mundo</p>

    <div class="auth-tabs">
      <button class="auth-tab active" onclick="switchTab('login')">Ingresar</button>
      <button class="auth-tab" onclick="switchTab('register')">Registrarse</button>
    </div>

    <div id="auth-form">
      <input type="email" id="auth-email" placeholder="Email">
      <input type="password" id="auth-password" placeholder="Contraseña">
      <button class="btn primary" onclick="handleAuth()">Ingresar</button>
      <div id="auth-error"></div>
    </div>
  </div>
</div>
```

### 5.2 Agregar botón de logout en el header
```html
<button class="btn" onclick="logout()">Salir</button>
```

### 5.3 Lógica JS principal

```javascript
// ── Auth State ──
let authToken = localStorage.getItem('pt_token');
let authUser  = JSON.parse(localStorage.getItem('pt_user') || 'null');
let authTab   = 'login';

function switchTab(tab) {
  authTab = tab;
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.querySelector('#auth-form button').textContent = 
    tab === 'login' ? 'Ingresar' : 'Registrarse';
}

async function handleAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  errEl.textContent = '';

  if (!email || !password) {
    errEl.textContent = 'Completá email y contraseña';
    return;
  }

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: authTab, email, password })
    });
    const data = await res.json();
    if (data.error) { errEl.textContent = data.error; return; }

    authToken = data.token;
    authUser  = data.user;
    localStorage.setItem('pt_token', authToken);
    localStorage.setItem('pt_user', JSON.stringify(authUser));

    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('user-email').textContent = authUser.email;
    loadPositions();
  } catch(e) {
    errEl.textContent = 'Error de conexión';
  }
}

function logout() {
  localStorage.removeItem('pt_token');
  localStorage.removeItem('pt_user');
  authToken = null;
  authUser  = null;
  positions = [];
  render();
  document.getElementById('auth-overlay').style.display = 'flex';
}

// Al cargar la página
if (!authToken) {
  document.getElementById('auth-overlay').style.display = 'flex';
} else {
  document.getElementById('auth-overlay').style.display = 'none';
  loadPositions();
}
```

### 5.4 Actualizar apiCall para enviar JWT
```javascript
async function apiCall(method, body=null, id=null) {
  const opts = {
    method,
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}` // JWT en lugar de x-user-id
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const url = id ? `/api/positions?id=${id}` : '/api/positions';
  const res = await fetch(url, opts);
  if (res.status === 401) { logout(); return null; } // token expirado
  if (method === 'DELETE' || res.status === 204) return null;
  return res.json();
}
```

---

## PASO 6 — CSS para la pantalla de auth

```css
.auth-overlay {
  position: fixed; inset: 0;
  background: var(--bg);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
}
.auth-box {
  background: var(--surface);
  border: 1px solid var(--border2);
  padding: 40px;
  width: 380px;
  text-align: center;
}
.auth-box h2 { font-family: var(--sans); font-size: 20px; color: var(--text-hi); margin-bottom: 4px; }
.auth-box p  { color: var(--green); font-size: 11px; letter-spacing: 0.1em; margin-bottom: 24px; }
.auth-tabs   { display: flex; gap: 4px; margin-bottom: 20px; }
.auth-tab    { flex: 1; padding: 8px; border: 1px solid var(--border2); background: transparent;
               color: var(--text-muted); cursor: pointer; font-family: var(--mono); font-size: 11px;
               text-transform: uppercase; letter-spacing: 0.07em; transition: all 0.15s; }
.auth-tab.active { border-color: var(--accent); color: var(--accent); background: var(--blue-bg); }
.auth-box input  { width: 100%; margin-bottom: 12px; }
.auth-box .btn   { width: 100%; margin-top: 4px; }
#auth-error      { color: var(--red); font-size: 11px; margin-top: 10px; min-height: 16px; }
```

---

## ORDEN DE IMPLEMENTACIÓN

1. Ejecutar SQL del Paso 1 en Supabase
2. Crear `api/auth.js`
3. Reemplazar `api/positions.js`
4. Actualizar `index.html` (auth overlay + lógica JS + apiCall)
5. Push a GitHub → Vercel despliega
6. Probar registro con un email nuevo
7. Probar login desde otro dispositivo

---

## NOTAS IMPORTANTES

- El token JWT de Supabase dura **1 hora** por defecto. Supabase lo renueva automáticamente si usás el cliente JS, pero como usamos fetch manual hay que manejar el refresh o simplemente pedir al usuario que vuelva a loguearse cuando expire.
- La `anon key` es pública y segura — las políticas RLS en Supabase garantizan que cada usuario solo accede a sus datos.
- Para el **portfolio maestro** del coordinador: una vez implementada la auth, se puede agregar una sección "Ver Reto" que cargue las posiciones del usuario coordinador en modo lectura.
