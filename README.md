# Portfolio Tracker

Tracker de acciones/ETFs con DCA (hasta 3 tramos), precios en tiempo real vía Yahoo Finance, y deploy automático a Vercel desde GitHub.

## Estructura

```
portfolio-tracker/
├── index.html                        # App completa
├── api/
│   └── quotes.js                     # Serverless function — proxy Yahoo Finance
├── .github/
│   └── workflows/
│       └── deploy.yml                # Auto-deploy a Vercel en cada push a main
├── vercel.json
└── README.md
```

---

## Setup inicial (una sola vez)

### 1. Subir a GitHub

```bash
cd portfolio-tracker
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/portfolio-tracker.git
git push -u origin main
```

### 2. Primer deploy manual desde CLI (necesario para obtener los IDs)

```bash
vercel
```

Vercel te va a preguntar:
- Set up and deploy? → **Y**
- Which scope? → tu cuenta
- Link to existing project? → **N**
- Project name? → `portfolio-tracker`
- In which directory? → `.` (Enter)

Cuando termine, ejecutá:

```bash
cat .vercel/project.json
```

Va a mostrar:
```json
{ "orgId": "team_xxxx", "projectId": "prj_xxxx" }
```

Guardá esos valores.

### 3. Agregar secrets en GitHub

En tu repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valor |
|--------|-------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create |
| `VERCEL_ORG_ID` | El `orgId` del `project.json` |
| `VERCEL_PROJECT_ID` | El `projectId` del `project.json` |

---

## Uso diario

```bash
git add .
git commit -m "descripción del cambio"
git push
# → deploy automático a Vercel
```

---

## Desarrollo local

```bash
vercel dev
# http://localhost:3000
```

El `index.html` detecta automáticamente el entorno:
- **localhost:3000 o .vercel.app** → usa `/api/quotes` (server-side, sin CORS)
- **Cualquier otro origen** → fallback a proxies CORS públicos
