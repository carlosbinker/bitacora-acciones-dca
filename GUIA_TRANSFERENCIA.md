# Guía de Transferencia — RETO 2026
## De: Carlos Binker (desarrollador) → A: Coordinadores / Profesores

---

## CONTEXTO

Esta aplicación fue desarrollada para el seguimiento de inversiones del RETO 2026.
Para garantizar la privacidad y seguridad de los datos de todos los usuarios,
la propiedad de la infraestructura debe estar en manos de los coordinadores.

Esta guía explica los pasos para completar esa transferencia.

---

## SERVICIOS INVOLUCRADOS

| Servicio | Función | URL |
|----------|---------|-----|
| **Supabase** | Base de datos y autenticación | supabase.com |
| **Vercel** | Hosting y deploy automático | vercel.com |
| **GitHub** | Código fuente | github.com/carlosbinker/portfolio-tracker |

---

## PASO 1 — Crear cuentas (coordinadores)

Cada coordinador necesita crear una cuenta en:

1. **GitHub** → github.com → Sign up
2. **Supabase** → supabase.com → Start for free
3. **Vercel** → vercel.com → Sign up (recomendado: usar la cuenta de GitHub)

---

## PASO 2 — Transferir Supabase

El coordinador designado como responsable técnico debe:

1. Crear un nuevo proyecto en Supabase
2. Avisar a Carlos con el **Project URL** y la **anon public key** del nuevo proyecto
3. Carlos ejecutará el script de migración de datos
4. Carlos actualizará las variables de entorno en Vercel

### Script de migración (lo ejecuta Carlos)
```sql
-- Este script recrea toda la estructura en el nuevo proyecto
-- Se ejecuta en el SQL Editor del nuevo proyecto Supabase

CREATE TABLE positions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ticker text not null,
  estado text not null default 'abierta',
  valor_actual numeric default 0,
  p_venta numeric,
  notas text default '',
  tramos jsonb not null default '[]',
  tipo text default 'personal',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own positions"
ON positions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Everyone can view coordinator positions"
ON positions FOR SELECT
USING (
  user_id = (SELECT id FROM profiles WHERE rol = 'coordinador' LIMIT 1)
);

CREATE TABLE profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  alias text,
  rol text default 'usuario',
  created_at timestamp with time zone default now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver todos los perfiles"
ON profiles FOR SELECT USING (true);

CREATE POLICY "Usuarios pueden editar su propio perfil"
ON profiles FOR ALL USING (auth.uid() = id);

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

## PASO 3 — Transferir Vercel

1. El coordinador crea cuenta en Vercel (con GitHub)
2. Carlos va a **Vercel → proyecto demo-acciones-dca → Settings → Transfer Project**
3. Ingresa el email del coordinador y confirma
4. El coordinador acepta la transferencia desde su email
5. Actualizar variables de entorno con las nuevas keys de Supabase:
   - `SUPABASE_URL` → nueva URL del proyecto
   - `SUPABASE_ANON_KEY` → nueva anon key

---

## PASO 4 — Transferir GitHub

### Opción A — Transferir el repo directamente
1. Carlos va a **GitHub → portfolio-tracker → Settings → Danger Zone → Transfer**
2. Ingresa el usuario GitHub del coordinador
3. El coordinador acepta desde su email

### Opción B — Crear una organización (recomendado)
1. Uno de los coordinadores crea una organización en GitHub
2. Carlos transfiere el repo a esa organización
3. Todos los coordinadores son agregados como owners
4. Carlos queda como colaborador (puede seguir contribuyendo)

---

## PASO 5 — Designar coordinadores en la app

Una vez migrado todo, el coordinador técnico ejecuta este SQL
en el nuevo proyecto Supabase para asignarse el rol de coordinador:

```sql
-- Reemplazar con el email real del coordinador
UPDATE profiles SET rol = 'coordinador'
WHERE email = 'email-del-coordinador@ejemplo.com';
```

Para agregar un segundo coordinador:
```sql
-- Si se quiere un segundo coordinador
UPDATE profiles SET rol = 'coordinador'
WHERE email = 'segundo-coordinador@ejemplo.com';
```

---

## PASO 6 — Verificación final

Checklist antes de dar por completada la transferencia:

- [ ] Nuevo proyecto Supabase funcionando con datos migrados
- [ ] Variables de entorno actualizadas en Vercel
- [ ] Deploy exitoso en Vercel
- [ ] Login funciona con usuarios existentes
- [ ] Coordinadores pueden ver el botón "GESTIONAR RETO"
- [ ] Portfolio maestro visible para todos los usuarios
- [ ] Carlos ya no tiene acceso de admin a Supabase ni Vercel

---

## SEGURIDAD — Lo que garantiza el sistema

| Dato | ¿Quién puede verlo? |
|------|-------------------|
| Contraseñas | **Nadie** — Supabase las hashea automáticamente |
| Posiciones de cada usuario | **Solo el propio usuario** — garantizado por RLS |
| Email de los usuarios | Solo el admin de Supabase (los coordinadores) |
| Portfolio maestro del RETO | **Todos los usuarios** — es público por diseño |

---

## CONTACTO TÉCNICO

Para consultas sobre el código o la implementación:
**Carlos Binker** — carlosbinker@gmail.com
GitHub: github.com/carlosbinker

---

*Documento generado el 22 de marzo de 2026*
