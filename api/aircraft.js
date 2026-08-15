export default async function handler(req, res) {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Math.max(5, Math.min(150, Number(req.query.radius) || 40));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Invalid latitude or longitude" });
  }

  const dlat = radius / 111;
  const dlon = radius / (111 * Math.cos(lat * Math.PI / 180));

  const lamin = lat - dlat;
  const lamax = lat + dlat;
  const lomin = lon - dlon;
  const lomax = lon + dlon;

  const url =
    `https://opensky-network.org/api/states/all` +
    `?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "PlaneHunter-Prototype"
      },
      cache: "no-store"
    });

    if (!r.ok) {
      throw new Error(`OpenSky HTTP ${r.status}`);
    }

    const j = await r.json();

    const aircraft = (j.states || []).map(a => ({
      icao: a[0],
      callsign: (a[1] || "").trim(),
      country: a[2],
      lon: a[5],
      lat: a[6],
      alt_m: a[7] ?? a[13],
      on_ground: a[8],
      speed_ms: a[9],
      track_deg: a[10],
      vertical_ms: a[11]
    }));

    return res.status(200).json({
      source: "OpenSky",
      count: aircraft.length,
      aircraft
    });

  } catch (e) {
    return res.status(502).json({
      error: e.message
    });
  }
}
