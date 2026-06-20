/* ============================================================
   /api/scores — Función serverless (Vercel)
   Hace de puente con football-data.org porque:
   1. Esa API bloquea llamadas directas desde el navegador (CORS)
   2. El token queda secreto en el servidor, nunca en el código
   3. El caché (60s) garantiza no pasar del límite gratis
      de 10 llamadas/minuto aunque tengas miles de visitantes
   ============================================================ */

export default async function handler(req, res) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "Falta FOOTBALL_DATA_TOKEN en Vercel" });
  }

  try {
    const r = await fetch(
      "https://api.football-data.org/v4/competitions/WC/matches",
      { headers: { "X-Auth-Token": token } }
    );

    if (!r.ok) {
      return res.status(r.status).json({ error: "API error " + r.status });
    }

    const data = await r.json();

    // Solo enviamos al navegador lo mínimo necesario
    const matches = (data.matches || []).map((m) => ({
      home: m.homeTeam?.tla || m.homeTeam?.name || "",
      away: m.awayTeam?.tla || m.awayTeam?.name || "",
      homeName: m.homeTeam?.name || "",
      awayName: m.awayTeam?.name || "",
      utcDate: m.utcDate,
      status: m.status, // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED
      stage: m.stage,   // GROUP_STAGE | LAST_32 | LAST_16 | QUARTER_FINALS | SEMI_FINALS | THIRD_PLACE | FINAL
      hg: m.score?.fullTime?.home,
      ag: m.score?.fullTime?.away,
      php: m.score?.penalties?.home, // penales (si los hubo)
      pap: m.score?.penalties?.away,
    }));

    // Caché en el CDN de Vercel: 60s fresco + 5 min de gracia.
    // Todos los visitantes comparten UNA llamada por minuto.
    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );
    return res.status(200).json({ updatedAt: Date.now(), matches });
  } catch (e) {
    return res.status(502).json({ error: "No se pudo contactar la API" });
  }
}
