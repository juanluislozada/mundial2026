# Mundial 2026 · Tracker

App web del Mundial 2026 con marcadores en vivo (football-data.org, plan gratis),
horarios automáticos por zona horaria, tablas de grupos calculadas en tiempo real
y espacio para sponsors. Sin IA, sin tokens, costo $0.

## Cómo publicarla (15 minutos, todo gratis)

### 1. Consigue tu token de la API
1. Entra a https://www.football-data.org/client/register
2. Regístrate gratis (solo email)
3. Te llega el token por correo (algo como `a1b2c3d4...`)

### 2. Sube el proyecto a GitHub
1. Crea un repositorio nuevo en github.com (ej. `mundial2026`)
2. Sube todos estos archivos (desde la web de GitHub puedes arrastrar
   la carpeta, o usa la app de GitHub en el celular)

### 3. Despliega en Vercel
1. Entra a https://vercel.com y crea cuenta con tu GitHub
2. "Add New Project" → importa el repo `mundial2026`
3. ANTES de darle Deploy: en "Environment Variables" agrega:
   - Name: `FOOTBALL_DATA_TOKEN`
   - Value: tu token del paso 1
4. Deploy. En ~1 minuto tienes tu URL: `mundial2026.vercel.app`
5. (Opcional) En Settings → Domains conecta tu dominio propio

## Cómo funciona

- `src/App.jsx` — toda la app. Calendario y grupos verificados como
  datos estáticos. Cada 60s consulta `/api/scores` para marcadores.
- `api/scores.js` — función serverless que llama a football-data.org
  con tu token (secreto) y cachea 60s en el CDN de Vercel. Aunque
  tengas 10,000 visitantes, solo se hace ~1 llamada por minuto:
  nunca pasas del límite gratis (10/min).
- `FALLBACK_RESULTS` en App.jsx — respaldo manual si la API falla.

## Probar en tu computadora (opcional)

```bash
npm install
npm run dev
```
Nota: en local el endpoint /api solo funciona con `vercel dev`
(instala Vercel CLI: `npm i -g vercel`).

## Monetización

El componente `SponsorSlot` (banner dorado) aparece en Partidos e Info.
Para activar un sponsor real, reemplaza el contenido del componente
con el logo y link de la marca.
