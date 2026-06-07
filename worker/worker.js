/**
 * Cloudflare Worker — DOAJ African Journals Cache
 *
 * - Cron (1st & 15th of month): fetch DOAJ CSV → filter African rows
 *   → extract needed columns → store compact JSON in KV
 * - GET /csv : serve pre-filtered JSON from KV (fast, no live DOAJ fetch)
 * - GET /status : check cache metadata
 * - GET /refresh?secret=XXX : force manual refresh
 */

const DOAJ_CSV_URL = "https://doaj.org/csv/journals";
const CACHE_KEY       = "african_journals";
const CACHE_META_KEY  = "african_journals_meta";
const WORLD_CACHE_KEY      = "world_journals";
const WORLD_CACHE_META_KEY = "world_journals_meta";
const KV_TTL = 30 * 24 * 3600; // 30 days safety TTL

const AFRICAN_COUNTRIES = new Set([
  "Algeria","Angola","Benin","Botswana","Burkina Faso",
  "Burundi","Cabo Verde","Cameroon","Central African Republic","Chad",
  "Comoros","Congo","DR Congo","Côte d'Ivoire","Djibouti",
  "Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia",
  "Gabon","Gambia","Ghana","Guinea","Guinea-Bissau",
  "Kenya","Lesotho","Liberia","Libya","Madagascar",
  "Malawi","Mali","Mauritania","Mauritius","Morocco",
  "Mozambique","Namibia","Niger","Nigeria","Rwanda",
  "São Tomé and Príncipe","Senegal","Seychelles","Sierra Leone","Somalia",
  "South Africa","South Sudan","Sudan","Tanzania","Togo",
  "Tunisia","Uganda","Zambia","Zimbabwe"
]);

// Columns needed for the world endpoint (minimal set for index-new.html)
const WORLD_COLS = [
  "Journal title",
  "Country of publisher",
  "ISSN",
  "EISSN",
  "URL in DOAJ",
  "Journal license",
  "APC",
  "APC amount",
  "APC amount currency",
];

// Columns to keep in the output JSON (exact DOAJ CSV header names)
const NEEDED_COLS = [
  "Journal title",
  "ISSN",
  "EISSN",
  "Journal URL",
  "Languages in which the journal accepts manuscripts",
  "Journal license",
  "Country of publisher",
  "Country of other organisation",
  "Average number of weeks between article submission and publication",
  "DOI",
  "Subjects",
  "Keywords",
  "When did the journal start to publish all content using an open license?",
  "Added on Date",
  "Review process",
  "Most Recent Article Added",
  "URL in DOAJ",
  "Author holds copyright without restrictions",
  "APC",
  "APC amount",
  "APC amount currency",
];

function canonicalCountry(s) {
  if (!s) return null;
  const t = String(s).trim().replace(/\s+/g, " ");
  if (!t) return null;
  const aliases = {
    "Cote d'Ivoire": "Côte d'Ivoire",
    "Cote dIvoire": "Côte d'Ivoire",
    "Sao Tome and Principe": "São Tomé and Príncipe",
    "Sao Tomé and Principe": "São Tomé and Príncipe"
  };
  return aliases[t] || t;
}

function splitMulti(v) {
  if (!v) return [];
  return String(v).replaceAll(";", ",").split(",").map(s => s.trim()).filter(Boolean);
}

function isAfrican(row, countryCol, otherOrgCol) {
  const c = canonicalCountry(row[countryCol] || "");
  if (c && AFRICAN_COUNTRIES.has(c)) return true;
  const others = splitMulti(row[otherOrgCol] || "").map(canonicalCountry);
  return others.some(x => x && AFRICAN_COUNTRIES.has(x));
}

// RFC 4180 CSV parser (handles quoted fields, escaped quotes)
function parseCSVText(text) {
  const headers = [];
  const rows = [];
  let pos = 0;
  const len = text.length;

  function readField() {
    if (pos >= len) return "";
    if (text[pos] === '"') {
      pos++;
      let val = "";
      while (pos < len) {
        if (text[pos] === '"') {
          if (pos + 1 < len && text[pos + 1] === '"') { val += '"'; pos += 2; }
          else { pos++; break; }
        } else {
          val += text[pos++];
        }
      }
      return val;
    }
    let val = "";
    while (pos < len && text[pos] !== ',' && text[pos] !== '\r' && text[pos] !== '\n') {
      val += text[pos++];
    }
    return val;
  }

  function readRow() {
    const fields = [];
    while (pos < len) {
      fields.push(readField());
      if (pos < len && text[pos] === ',') { pos++; }
      else { break; }
    }
    if (pos < len && text[pos] === '\r') pos++;
    if (pos < len && text[pos] === '\n') pos++;
    return fields;
  }

  const hFields = readRow();
  hFields.forEach(h => headers.push(h.trim()));

  while (pos < len) {
    const fields = readRow();
    if (fields.length === 0 || (fields.length === 1 && !fields[0])) continue;
    const row = {};
    headers.forEach((h, i) => { row[h] = fields[i] !== undefined ? fields[i] : ""; });
    rows.push(row);
  }

  return { headers, rows };
}

// Find a column name in headers (exact → case-insensitive → substring)
function findColumn(headers, ...candidates) {
  for (const c of candidates) {
    const h = headers.find(h => h === c);
    if (h) return h;
  }
  for (const c of candidates) {
    const h = headers.find(h => h.toLowerCase() === c.toLowerCase());
    if (h) return h;
  }
  for (const c of candidates) {
    const h = headers.find(h => h.toLowerCase().includes(c.toLowerCase()));
    if (h) return h;
  }
  return null;
}

/**
 * Build world stats cache: aggregate ALL journals by country.
 * Stored as { cachedAt, totalRows, countries: { [name]: { count, journals[] } } }
 * where each journal has short keys: t=title, i=issn, e=eissn, u=url, l=license,
 * a=APC (Yes/No), am=APC amount, ac=APC currency.
 */
async function buildWorldCache(env) {
  const resp = await fetch(DOAJ_CSV_URL, {
    headers: { "User-Agent": "DOAJ-World-Observatory/1.0 (https://azilan.me)" },
  });
  if (!resp.ok) throw new Error(`DOAJ CSV fetch failed: ${resp.status}`);
  const csvText = await resp.text();

  const { headers, rows } = parseCSVText(csvText);

  const colMap = {};
  for (const col of WORLD_COLS) {
    const actual = findColumn(headers, col);
    if (actual) colMap[col] = actual;
  }
  const countryCol = colMap["Country of publisher"];
  if (!countryCol) throw new Error("Could not locate 'Country of publisher' column");

  const countries = {};
  for (const row of rows) {
    const country = (row[countryCol] || "").trim();
    if (!country) continue;
    if (!countries[country]) countries[country] = { count: 0, journals: [] };
    countries[country].count++;
    countries[country].journals.push({
      t:  row[colMap["Journal title"]]          || "",
      i:  row[colMap["ISSN"]]                   || "",
      e:  row[colMap["EISSN"]]                  || "",
      u:  row[colMap["URL in DOAJ"]]            || "",
      l:  row[colMap["Journal license"]]        || "",
      a:  row[colMap["APC"]]                    || "",
      am: row[colMap["APC amount"]]             || "",
      ac: row[colMap["APC amount currency"]]    || "",
    });
  }

  const meta = {
    cachedAt:  new Date().toISOString(),
    totalRows: rows.length,
    countryCount: Object.keys(countries).length,
  };

  const payload = JSON.stringify({ ...meta, countries });
  await env.DOAJ_KV.put(WORLD_CACHE_KEY,      payload,               { expirationTtl: KV_TTL });
  await env.DOAJ_KV.put(WORLD_CACHE_META_KEY, JSON.stringify(meta),  { expirationTtl: KV_TTL });

  return meta;
}

async function buildCache(env) {
  const resp = await fetch(DOAJ_CSV_URL, {
    headers: { "User-Agent": "DOAJ-African-Observatory/1.0 (https://azilan.me)" },
  });
  if (!resp.ok) throw new Error(`DOAJ CSV fetch failed: ${resp.status} ${resp.statusText}`);
  const csvText = await resp.text();

  const { headers, rows } = parseCSVText(csvText);

  const countryCol    = findColumn(headers, "Country of publisher");
  const otherOrgCol   = findColumn(headers,
    "Country of other organisation",
    "Country of other organization",
    "Country of other organisations"
  );

  if (!countryCol) throw new Error("Could not locate 'Country of publisher' column in DOAJ CSV");

  // Map each needed column name to its actual header in this CSV
  const colMap = {};
  for (const needed of NEEDED_COLS) {
    const actual = findColumn(
      headers,
      needed,
      // Known alternates
      ...(needed === "Country of other organisation"
        ? ["Country of other organization", "Country of other organisations"] : []),
      ...(needed === "Most Recent Article Added"
        ? ["Most Recent Article Added Date", "Most Recent Article"] : []),
    );
    if (actual) colMap[needed] = actual;
  }

  const african = rows
    .filter(row => isAfrican(row, countryCol, otherOrgCol))
    .map(row => {
      const out = {};
      for (const [needed, actual] of Object.entries(colMap)) {
        out[needed] = row[actual] || "";
      }
      return out;
    });

  const meta = {
    cachedAt: new Date().toISOString(),
    count: african.length,
    totalRows: rows.length,
  };

  await env.DOAJ_KV.put(CACHE_KEY,      JSON.stringify(african), { expirationTtl: KV_TTL });
  await env.DOAJ_KV.put(CACHE_META_KEY, JSON.stringify(meta),    { expirationTtl: KV_TTL });

  return meta;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  // ── HTTP handler ────────────────────────────────────────────────────────────
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // /refresh?secret=XXX — manual refresh (protect with a secret)
    if (url.pathname === "/refresh") {
      if (!env.REFRESH_SECRET || url.searchParams.get("secret") !== env.REFRESH_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const meta = await buildCache(env);
        return new Response(JSON.stringify({ ok: true, ...meta }), {
          headers: { ...CORS, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 500, headers: { ...CORS, "Content-Type": "application/json" }
        });
      }
    }

    // /status — cache metadata
    if (url.pathname === "/status") {
      const meta = await env.DOAJ_KV.get(CACHE_META_KEY);
      return new Response(meta || '{"cached":false}', {
        headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    // /csv/world — serve world-wide pre-aggregated JSON (for index-new.html)
    if (url.pathname === "/csv/world") {
      let cached  = await env.DOAJ_KV.get(WORLD_CACHE_KEY);
      let metaRaw = await env.DOAJ_KV.get(WORLD_CACHE_META_KEY);

      if (!cached) {
        // Cold start: build synchronously (first request will be slow ~30s)
        try {
          const meta = await buildWorldCache(env);
          cached  = await env.DOAJ_KV.get(WORLD_CACHE_KEY);
          metaRaw = JSON.stringify(meta);
        } catch (e) {
          return new Response(JSON.stringify({ error: "Cache build failed: " + e.message }), {
            status: 503, headers: { ...CORS, "Content-Type": "application/json" }
          });
        }
      }

      const meta = metaRaw ? JSON.parse(metaRaw) : {};
      return new Response(cached, {
        headers: {
          ...CORS,
          "Content-Type":  "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Cache-Date":  meta.cachedAt || "",
          "X-Total-Rows":  String(meta.totalRows || 0),
        }
      });
    }

    // /csv (or /) — serve pre-filtered JSON
    if (url.pathname === "/csv" || url.pathname === "/") {
      let cached   = await env.DOAJ_KV.get(CACHE_KEY);
      let metaRaw  = await env.DOAJ_KV.get(CACHE_META_KEY);

      // Cold start: trigger background rebuild and return 503 immediately.
      // The next request (after the cron/refresh runs) will serve from KV.
      if (!cached) {
        ctx.waitUntil(
          buildCache(env).catch(e => console.error("DOAJ cold-start cache build failed:", e.message))
        );
        return new Response(JSON.stringify({ error: "Cache warming up — please retry in a few minutes." }), {
          status: 503, headers: { ...CORS, "Content-Type": "application/json" }
        });
      }

      const meta = metaRaw ? JSON.parse(metaRaw) : {};
      return new Response(cached, {
        headers: {
          ...CORS,
          "Content-Type":  "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "X-Cache-Date":  meta.cachedAt  || "",
          "X-Cache-Count": String(meta.count || 0),
        }
      });
    }

    return new Response("Not found", { status: 404 });
  },

  // ── Cron handler (1st of every month at 00:00 UTC) ──────────────────────────
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      Promise.all([
        buildCache(env)
          .then(meta => console.log(`DOAJ African cache refreshed: ${meta.count} journals`))
          .catch(e  => console.error("DOAJ African cache refresh failed:", e.message)),
        buildWorldCache(env)
          .then(meta => console.log(`DOAJ World cache refreshed: ${meta.totalRows} journals, ${meta.countryCount} countries`))
          .catch(e  => console.error("DOAJ World cache refresh failed:", e.message)),
      ])
    );
  }
};
