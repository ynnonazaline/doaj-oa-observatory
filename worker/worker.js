/**
 * Cloudflare Worker — DOAJ African Journals Cache
 *
 * - Cron (1st of month): fetch DOAJ CSV → filter African rows
 *   → extract needed columns → store compact JSON in KV
 *   → query Crossref + OpenAlex for all ISSNs → store enrichment JSON in KV
 * - GET /csv          : pre-filtered African journals JSON
 * - GET /enrichment   : pre-computed Crossref + OpenAlex counts per ISSN
 * - GET /status       : cache metadata
 * - GET /refresh?secret=XXX : force manual refresh of all caches
 */

const DOAJ_CSV_URL = "https://doaj.org/csv";
const CACHE_KEY       = "african_journals";
const CACHE_META_KEY  = "african_journals_meta";
const WORLD_CACHE_KEY      = "world_journals";
const WORLD_CACHE_META_KEY = "world_journals_meta";
const ENRICHMENT_KEY      = "enrichment_cache";
const ENRICHMENT_META_KEY = "enrichment_cache_meta";
const KV_TTL = 35 * 24 * 3600;

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
  "License attributes",
  "URL for license terms",
  "Country of publisher",
  "Country of other organisation",
  "Average number of weeks between article submission and publication",
  "DOI",
  "Subjects",
  "Keywords",
  "When did the journal start to publish all content using an open license?",
  "Added on Date",
  "Review process",
  "Review process information URL",
  "Most Recent Article Added",
  "URL in DOAJ",
  "Author holds copyright without restrictions",
  "APC",
  "APC information URL",
  "APC amount",
  "APC amount currency",
  "Preservation Services",
  "Preservation Service: national library",
  "Persistent article identifiers",
  "Publisher",
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

  // Pre-filter: keep only lines that mention an African country.
  // Reduces ~22 000 rows → ~200, cutting CPU + memory by ~99 %.
  const AFRICAN_LIST = [...AFRICAN_COUNTRIES];
  const nlIdx = csvText.indexOf('\n');
  const headerLine = nlIdx === -1 ? csvText : csvText.slice(0, nlIdx + 1);
  const bodyText   = nlIdx === -1 ? '' : csvText.slice(nlIdx + 1);
  const filteredCsv = headerLine + bodyText.split('\n')
    .filter(line => AFRICAN_LIST.some(c => line.includes(c)))
    .join('\n');

  const { headers, rows } = parseCSVText(filteredCsv);

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

// ── Enrichment helpers ───────────────────────────────────────────────────────

function normIssnW(v) {
  if (!v) return '';
  const s = String(v).replace(/[^0-9Xx]/g, '').toUpperCase();
  return s.length === 8 ? s.slice(0, 4) + '-' + s.slice(4) : String(v).trim().toUpperCase();
}

async function crCount(issn) {
  if (!issn || !/^\d{4}-\d{3}[\dXx]$/i.test(issn)) return null;
  try {
    const r = await fetch(
      `https://api.crossref.org/journals/${encodeURIComponent(issn)}/works?rows=1&mailto=contact@azilan.me`,
      { headers: { 'User-Agent': 'DOAJ-Observatory/1.0 (https://azilan.me)' } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const n = d?.message?.['total-results'];
    return typeof n === 'number' ? n : null;
  } catch { return null; }
}


async function batchRun(items, size, fn) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function buildEnrichmentCache(env) {
  const raw = await env.DOAJ_KV.get(CACHE_KEY);
  if (!raw) throw new Error('African journals KV not found — run /refresh first');
  const journals = JSON.parse(raw);

  const crossref = {};
  const openalex = {};

  // ── Crossref: one request per journal (individual API, no bulk endpoint) ──
  await batchRun(journals, 10, async j => {
    const ei = normIssnW(j['EISSN'] || '');
    const pi = normIssnW(j['ISSN']  || '');
    if (!ei && !pi) return;
    let count = null;
    if (ei) { count = await crCount(ei); crossref[ei] = count; }
    if ((!count || count === 0) && pi && pi !== ei) {
      count = await crCount(pi); crossref[pi] = count;
    }
  });

  // OpenAlex: skipped — cloud IPs (Cloudflare) are blocked by OpenAlex free tier.
  // OpenAlex data is fetched client-side from the visitor's browser IP instead.

  const meta = {
    generated:      new Date().toISOString(),
    journals:       journals.length,
    foundCrossref:  Object.values(crossref).filter(v => v && v > 0).length,
    foundOpenalex:  Object.keys(openalex).length,
  };

  await env.DOAJ_KV.put(ENRICHMENT_KEY,      JSON.stringify({ ...meta, crossref, openalex }), { expirationTtl: KV_TTL });
  await env.DOAJ_KV.put(ENRICHMENT_META_KEY, JSON.stringify(meta), { expirationTtl: KV_TTL });
  return meta;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  // ── HTTP handler ────────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);

    // /report-oa (POST) — browser reports resolved OpenAlex data for KV caching
    if (url.pathname === "/report-oa" && request.method === "POST") {
      try {
        const incoming = await request.json();
        if (!incoming || typeof incoming !== "object") {
          return new Response(JSON.stringify({ ok: false }), { status: 400, headers: CORS });
        }
        const clean = {};
        for (const [issn, val] of Object.entries(incoming)) {
          if (!/^\d{4}-[\dXx]{4}$/i.test(issn)) continue;
          if (val && typeof val.works_count === "number" && val.works_count > 0 &&
              typeof val.id === "string" && val.id.startsWith("https://openalex.org/")) {
            clean[issn] = { id: val.id, works_count: val.works_count };
          } else {
            clean[issn] = null;
          }
        }
        const existingRaw = await env.DOAJ_KV.get(ENRICHMENT_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        // Merge: incoming data fills gaps, existing non-null values take priority
        const prevOA = existing.openalex || {};
        const mergedOA = { ...clean, ...Object.fromEntries(Object.entries(prevOA).filter(([,v]) => v)) };
        await env.DOAJ_KV.put(
          ENRICHMENT_KEY,
          JSON.stringify({ ...existing, openalex: mergedOA }),
          { expirationTtl: KV_TTL }
        );
        return new Response(JSON.stringify({ ok: true, stored: Object.keys(clean).length }), { headers: CORS });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false }), { status: 500, headers: CORS });
      }
    }

    // /topics (POST) — generate a journal's main research topics from article abstracts,
    // using Cloudflare Workers AI (open-weight model, no external API key).
    if (url.pathname === "/topics" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: CORS });
      }

      const abstracts = Array.isArray(body && body.abstracts)
        ? body.abstracts.filter(a => typeof a === "string" && a.trim().length > 0)
        : [];

      if (!abstracts.length) {
        return new Response(JSON.stringify({ error: "no_abstracts" }), { status: 400, headers: CORS });
      }

      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "cette revue";
      const domain = typeof body.domain === "string" && body.domain.trim() ? body.domain.trim() : null;
      const subfields = Array.isArray(body.subfields)
        ? body.subfields.filter(s => typeof s === "string" && s.trim().length > 0).slice(0, 3)
        : [];

      // Server-side caps, independent of what the frontend sends.
      const capped = abstracts.slice(0, 100);
      let combined = capped.join("\n\n---\n\n");
      if (combined.length > 8000) combined = combined.slice(0, 8000);

      const factsLines = ["Nom de la revue : " + title];
      if (domain) factsLines.push("Grand domaine scientifique (déjà en français) : " + domain);
      if (subfields.length) factsLines.push("Principales sous-disciplines (en anglais, à traduire naturellement en français) : " + subfields.join(", "));

      const systemPrompt = (domain || subfields.length)
        ? "Tu es un assistant qui rédige une courte présentation éditoriale d'une revue scientifique. On te donne le nom de la revue, éventuellement son grand domaine scientifique (déjà en français) et ses principales sous-disciplines (en anglais, à traduire naturellement en français), ainsi que des résumés d'articles qu'elle a publiés. Rédige un texte en français qui commence par UNE SEULE phrase de ce format exact, en remplaçant les crochets et en traduisant les sous-disciplines en français courant : \"[Nom de la revue] est une revue en [domaine], spécialisée en [sous-discipline 1], [sous-discipline 2] et [sous-discipline 3].\" (adapte la liste à 1, 2 ou 3 éléments selon ce qui est fourni ; si aucun domaine n'est fourni, commence simplement par \"[Nom de la revue] est une revue spécialisée en [sous-disciplines].\"). Poursuis ensuite avec 2 à 4 phrases supplémentaires, en français, qui décrivent les grandes thématiques de recherche abordées par la revue à partir des résumés fournis, en les regroupant (n'énumère jamais les articles un par un, ne cite aucun titre d'article). N'utilise ni tiret, ni liste à puces, ni titre : uniquement du texte continu."
        : "Tu es un assistant qui rédige une courte présentation éditoriale d'une revue scientifique à partir de résumés d'articles qu'elle a publiés. Rédige un texte fluide de 3 à 5 phrases, en français, qui décrit les grandes thématiques de recherche abordées par la revue en les regroupant (n'énumère jamais les articles un par un, ne cite aucun titre d'article). Commence par une phrase qui nomme la revue telle qu'elle t'est donnée. N'utilise ni tiret, ni liste à puces, ni titre : uniquement du texte continu.";

      try {
        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: factsLines.join("\n") + "\n\nRésumés d'articles :\n" + combined }
          ],
          max_tokens: 450
        });
        const topics = result && result.response ? String(result.response).trim() : "";
        if (!topics) {
          return new Response(JSON.stringify({ error: "ai_failed" }), { status: 502, headers: CORS });
        }
        return new Response(JSON.stringify({ topics }), {
          headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "ai_failed" }), { status: 502, headers: CORS });
      }
    }

    // /refresh?secret=XXX — manual refresh (protect with a secret)
    if (url.pathname === "/refresh") {
      if (!env.REFRESH_SECRET || url.searchParams.get("secret") !== env.REFRESH_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      ctx.waitUntil(
        buildCache(env)
          .then(() => buildEnrichmentCache(env))
          .then(meta => console.log("Full refresh done", JSON.stringify(meta)))
          .catch(e  => console.error("Refresh failed:", e.message))
      );
      return new Response(JSON.stringify({ ok: true, message: "Refresh started in background. Check /status in ~2 minutes." }), {
        status: 202, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    // /enrichment — pre-computed Crossref + OpenAlex counts (loaded once per visitor at startup)
    if (url.pathname === "/enrichment") {
      const cached  = await env.DOAJ_KV.get(ENRICHMENT_KEY);
      const metaRaw = await env.DOAJ_KV.get(ENRICHMENT_META_KEY);
      if (!cached) {
        return new Response(JSON.stringify({ error: "Enrichment cache not yet built — trigger /refresh first." }), {
          status: 503, headers: { ...CORS, "Content-Type": "application/json" }
        });
      }
      const meta = metaRaw ? JSON.parse(metaRaw) : {};
      return new Response(cached, {
        headers: {
          ...CORS,
          "Content-Type":  "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
          "X-Generated":   meta.generated || "",
        }
      });
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
      // Step 1: refresh journal list, then Step 2: build enrichment from it
      Promise.all([
        buildCache(env)
          .then(meta => console.log(`DOAJ African cache refreshed: ${meta.count} journals`))
          .then(() => buildEnrichmentCache(env))
          .then(meta => console.log(`Enrichment cache built: ${meta.foundCrossref} Crossref, ${meta.foundOpenalex} OpenAlex`))
          .catch(e  => console.error("DOAJ African / enrichment cache refresh failed:", e.message)),
        buildWorldCache(env)
          .then(meta => console.log(`DOAJ World cache refreshed: ${meta.totalRows} journals, ${meta.countryCount} countries`))
          .catch(e  => console.error("DOAJ World cache refresh failed:", e.message)),
      ])
    );
  }
};
