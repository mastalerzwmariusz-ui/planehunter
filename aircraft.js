export default async function handler(req, res) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Math.max(5, Math.min(150, Number(req.query.radius || 40)));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Invalid latitude/longitude" });
  }

  const dlat = radius / 111;
  const dlon = radius / (111 * Math.cos(lat * Math.PI / 180));

  const sources = [
    {
      name: "OpenSky",
      url: `https://opensky-network.org/api/states/all?lamin=${lat-dlat}&lamax=${lat+dlat}&lomin=${lon-dlon}&lomax=${lon+dlon}`,
      parse: (j) => (j.states || []).map(a => ({
        icao: a[0], callsign: (a[1] || "").trim(), country: a[2],
        lon: a[5], lat: a[6], alt_m: a[7] ?? a[13],
        speed_ms: a[9], track_deg: a[10], vertical_ms: a[11]
      }))
    }
  ];

  let lastError = "No source available";

  for (const s of sources) {
    try {
      const r = await fetch(s.url, {
        headers: { "User-Agent": "PlaneHunter-Prototype/0.3" },
        cache: "no-store"
      });
      if (!r.ok) throw new Error(`${s.name} HTTP ${r.status}`);
      const j = await r.json();
      const aircraft = s.parse(j).filter(a => a.lat != null && a.lon != null);
      res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
      return res.status(200).json({ source: s.name, aircraft });
    } catch (e) {
      lastError = e.message || String(e);
    }
  }

  return res.status(502).json({ error: lastError });
}
