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

    const matches = (data.matches || []).map((m) => ({
      home: m.homeTeam?.tla || m.homeTeam?.name || "",
      away: m.awayTeam?.tla || m.awayTeam?.name || "",
      homeName: m.homeTeam?.name || "",
      awayName: m.awayTeam?.name || "",
      utcDate: m.utcDate,
      status: m.status,
      hg: m.score?.fullTime?.home,
      ag: m.score?.fullTime?.away,
    }));

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );
    return res.status(200).json({ updatedAt: Date.now(), matches });
  } catch (e) {
    return res.status(502).json({ error: "No se pudo contactar la API" });
  }
}
