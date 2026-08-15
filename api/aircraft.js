export default async function handler(req, res) {

  // CORS + no-cache

  res.setHeader("Access-Control-Allow-Origin", "*");

  res.setHeader("Cache-Control", "no-store");

  const lat = Number(req.query.lat);

  const lon = Number(req.query.lon);

  const radius = Math.max(

    5,

    Math.min(150, Number(req.query.radius) || 40)

  );

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {

    return res.status(400).json({

      error: "Invalid latitude or longitude"

    });

  }

  // Convert radius to approximate bounding box

  const dLat = radius / 111;

  const cosLat = Math.cos((lat * Math.PI) / 180);

  const dLon = radius / (111 * Math.max(0.1, Math.abs(cosLat)));

  const lamin = lat - dLat;

  const lamax = lat + dLat;

  const lomin = lon - dLon;

  const lomax = lon + dLon;

  const url =

    "https://opensky-network.org/api/states/all" +

    `?lamin=${encodeURIComponent(lamin)}` +

    `&lomin=${encodeURIComponent(lomin)}` +

    `&lamax=${encodeURIComponent(lamax)}` +

    `&lomax=${encodeURIComponent(lomax)}`;

  try {

    const response = await fetch(url, {

      headers: {

        "User-Agent": "PlaneHunter/0.5",

        "Accept": "application/json"

      },

      cache: "no-store"

    });

    if (!response.ok) {

      const body = await response.text();

      return res.status(502).json({

        error: "Aircraft data provider error",

        providerStatus: response.status,

        details: body.slice(0, 300)

      });

    }

    const data = await response.json();

    const states = Array.isArray(data.states)

      ? data.states

      : [];

    return res.status(200).json({

      ok: true,

      time: data.time || null,

      count: states.length,

      states

    });

  } catch (error) {

    return res.status(500).json({

      error: "Unable to fetch aircraft data",

      details: String(error?.message || error)

    });

  }

}
