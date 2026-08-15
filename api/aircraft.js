export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radiusKm = Math.max(
    5,
    Math.min(150, Number(req.query.radius) || 40)
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({
      error: "Invalid latitude or longitude"
    });
  }

  const radiusNm = Math.max(
    1,
    Math.min(250, Math.ceil(radiusKm / 1.852))
  );

  const providers = [
    {
      name: "ADSB.lol",
      url: `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radiusNm}`
    },
    {
      name: "adsb.fi",
      url: `https://opendata.adsb.fi/api/v3/lat/${lat}/lon/${lon}/dist/${radiusNm}`
    }
  ];

  let lastError = "No provider available";

  for (const provider of providers) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 6500);

    try {
      const response = await fetch(provider.url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PlaneHunter/0.5"
        },
        signal: controller.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          `${provider.name} HTTP ${response.status}`
        );
      }

      const data = await response.json();

      const raw = Array.isArray(data.ac)
        ? data.ac
        : [];

      const aircraft = raw
        .filter(
          a =>
            Number.isFinite(Number(a.lat)) &&
            Number.isFinite(Number(a.lon))
        )
        .map(a => ({
          icao: a.hex || null,
          callsign: (a.flight || "").trim(),
          registration: a.r || null,
          type: a.t || null,
          lat: Number(a.lat),
          lon: Number(a.lon),
          alt_ft:
            a.alt_baro === "ground"
              ? 0
              : finiteOrNull(a.alt_baro),
          speed_kt: finiteOrNull(a.gs),
          track_deg: finiteOrNull(a.track),
          vertical_fpm: finiteOrNull(a.baro_rate),
          squawk: a.squawk || null,
          category: a.category || null,
          dbFlags: finiteOrZero(a.dbFlags)
        }));

      return res.status(200).json({
        source: provider.name,
        count: aircraft.length,
        radius_km: radiusKm,
        aircraft
      });

    } catch (error) {
      lastError =
        error?.name === "AbortError"
          ? `${provider.name} timed out`
          : error?.message || `${provider.name} failed`;

    } finally {
      clearTimeout(timeout);
    }
  }

  return res.status(502).json({
    error: lastError
  });
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function finiteOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
