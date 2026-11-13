/**
 * Cloudflare Worker — DOAJ African Journals Cache
 *
 * - Cron (weekly, see [triggers] in wrangler.toml): fetch DOAJ CSV → filter African rows
 *   → extract needed columns → store compact JSON in KV
 *   → query Crossref for all ISSNs → store enrichment JSON in KV
 *   The KV entries live 35 days (KV_TTL), so the cron must run at least monthly
 *   or /csv starts answering 503 "cache warming up" to the first visitors.
 * - GET  /csv          : pre-filtered African journals JSON
 * - GET  /enrichment   : pre-computed Crossref + OpenAlex + OpenCitations per ISSN
 * - GET  /status       : cache metadata
 * - GET  /refresh?secret=XXX : force manual refresh of all caches
 * - POST /report-oa    : browsers report the OpenAlex data they resolved
 * - POST /report-oc    : browsers report the OpenCitations hits they resolved
 * - POST /report-cr    : browsers report the Crossref counts they resolved
 *
 * Les trois /report-* existent parce qu'une invocation de Worker ne dispose que
 * d'une cinquantaine de sous-requêtes : le cache d'enrichissement est alimenté
 * par les visiteurs, le cron ne fait qu'en rafraîchir une tranche par passage.
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
];

// Colonnes transportées du CSV DOAJ vers le cache KV. Toute colonne absente
// d'ici est invisible pour le front, même si index.html la lit : c'est la cause
// des champs « Éditeur », « Texte de la licence » et « Articles indexés » vides.
// NB : le DOAJ a retiré « DOI » et « APC amount currency » de son export (54 ->
// 52 colonnes). La devise est désormais incluse dans « APC amount » (« 2000 USD »,
// parfois « 1100 USD; 740 GBP »), que splitApcAmount() sait lire.
const NEEDED_COLS = [
  "Journal title",
  "ISSN",
  "EISSN",
  "Journal URL",
  "Publisher",
  "Languages in which the journal accepts manuscripts",
  "Journal license",
  "License attributes",
  "URL for license terms",
  "Country of publisher",
  "Country of other organisation",
  "Average number of weeks between article submission and publication",
  "Subjects",
  "Keywords",
  "When did the journal start to publish all content using an open license?",
  "Added on Date",
  "Review process",
  "Review process information URL",
  "Most Recent Article Added",
  "Number of Article Records",
  "URL in DOAJ",
  "Author holds copyright without restrictions",
  "APC",
  "APC information URL",
  "APC amount",
  "Preservation Services",
  "Preservation Service: national library",
  "Persistent article identifiers",
];

/**
 * Le DOAJ a fusionné « APC amount currency » dans « APC amount » : la valeur
 * ressemble à « 2000 USD », parfois « 1100 USD; 740 GBP » (plusieurs devises).
 * On ne garde que la première paire, et on la resépare en { am, ac } pour que
 * le contrat du endpoint /csv/world reste inchangé.
 */
function splitApcAmount(raw) {
  const first = String(raw || "").split(/[|;]/)[0].trim();
  const num  = first.match(/\d+/);
  const code = first.toUpperCase().match(/(?:^|[^A-Z])([A-Z]{3})(?:[^A-Z]|$)/);
  return { am: num ? num[0] : "", ac: code ? code[1] : "" };
}

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

// RFC 4180 CSV parser (handles quoted fields, escaped quotes).
// Variante incrémentale : appelle onRow(fields, headers) pour chaque ligne sans
// jamais les accumuler. Matérialiser les 23 592 lignes × 52 colonnes du CSV
// complet monte à ~795 Mio, bien au-delà des 128 Mo d'un isolat Worker — c'est
// ce qui faisait échouer buildWorldCache à chaque passage du cron.
// Lit UN enregistrement dans `text` à partir de `from`.
// Renvoie { fields, next }, ou null si l'enregistrement déborde du tampon et
// qu'il reste des octets à lire (atEof === false).
// `wanted` : Set d'indices de colonnes à construire ; les autres sont traversées
// sans rien allouer (9 colonnes utiles sur 52 dans le CSV mondial). Les valeurs
// conservées sont assemblées caractère par caractère, donc autonomes : le tampon
// qui les a produites peut être libéré.
function readRecord(text, from, wanted, atEof) {
  const len = text.length;
  let pos = from;
  const fields = [];
  let i = 0;

  for (;;) {
    const keep = !wanted || wanted.has(i);
    let val = "";

    if (pos < len && text[pos] === '"') {
      pos++;
      for (;;) {
        if (pos >= len) { if (!atEof) return null; break; }   // guillemet jamais refermé
        const c = text[pos];
        if (c === '"') {
          if (pos + 1 >= len) {            // "" échappé ou fin de champ ? on ne peut pas savoir
            if (!atEof) return null;
            pos++;
            break;
          }
          if (text[pos + 1] === '"') { if (keep) val += '"'; pos += 2; continue; }
          pos++;
          break;
        }
        if (keep) val += c;
        pos++;
      }
    } else {
      while (pos < len && text[pos] !== ',' && text[pos] !== '\r' && text[pos] !== '\n') {
        if (keep) val += text[pos];
        pos++;
      }
      if (pos >= len && !atEof) return null;  // le champ continue peut-être
    }

    fields.push(val);
    i++;
    if (pos < len && text[pos] === ',') { pos++; continue; }
    break;
  }

  if (pos >= len && !atEof) return null;      // séparateur de ligne pas encore lu
  if (pos < len && text[pos] === '\r') pos++;
  if (pos < len && text[pos] === '\n') pos++;
  return { fields, next: pos };
}

function isBlankRecord(fields) {
  return fields.length === 0 || (fields.length === 1 && !fields[0]);
}

// La 1re colonne est toujours construite : la détection de ligne vide s'y appuie.
function wantedSet(onHeaders, headers) {
  if (!onHeaders) return null;
  const w = onHeaders(headers);
  return w ? new Set(w).add(0) : null;
}

// Parcourt le corps de la réponse au fil de l'eau : le CSV mondial (25 Mo, soit
// ~50 Mo en mémoire) ne tient pas dans les 128 Mo d'un isolat Worker en plus de
// l'agrégat. C'est ce qui faisait échouer buildWorldCache à chaque cron.
async function parseCSVFromStream(body, onRow, onHeaders) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", from = 0, headers = null, wanted = null, atEof = false;

  for (;;) {
    const r = await reader.read();
    if (r.done) atEof = true;
    else if (r.value) buf += r.value;

    for (;;) {
      const rec = readRecord(buf, from, headers ? wanted : null, atEof);
      if (!rec || rec.next === from) break;
      from = rec.next;
      if (!headers) {
        headers = rec.fields.map(h => h.trim());
        wanted = wantedSet(onHeaders, headers);
      } else if (!isBlankRecord(rec.fields)) {
        onRow(rec.fields, headers);
      }
      if (from >= buf.length) break;
    }

    if (from > 0) { buf = buf.slice(from); from = 0; }   // on ne garde que le reste
    if (atEof) break;
  }

  return headers || [];
}

// Variante « tout en mémoire » : réservée au corpus africain, pré-filtré à
// ~1 000 lignes avant d'arriver ici.
function parseCSVText(text) {
  const rows = [];
  let from = 0, headers = null;
  for (;;) {
    const rec = readRecord(text, from, null, true);
    if (!rec || rec.next === from) break;
    from = rec.next;
    if (!headers) {
      headers = rec.fields.map(h => h.trim());
    } else if (!isBlankRecord(rec.fields)) {
      const row = {};
      headers.forEach((h, i) => { row[h] = rec.fields[i] !== undefined ? rec.fields[i] : ""; });
      rows.push(row);
    }
    if (from >= text.length) break;
  }
  return { headers: headers || [], rows };
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

  // Les colonnes utiles, par position : on ne garde que ce qu'on agrège, ligne
  // après ligne, sans jamais charger le CSV entier.
  let idx = null;
  const buildIdx = hdrs => {
    const m = {};
    for (const col of WORLD_COLS) {
      const actual = findColumn(hdrs, col);
      m[col] = actual ? hdrs.indexOf(actual) : -1;
    }
    return m;
  };

  const countries = {};
  let totalRows = 0;

  const headers = await parseCSVFromStream(resp.body, (fields) => {
    totalRows++;
    const ci = idx["Country of publisher"];
    if (ci < 0) return;
    const country = (fields[ci] || "").trim();
    if (!country) return;
    const at = col => { const i = idx[col]; return (i >= 0 && fields[i]) || ""; };
    if (!countries[country]) countries[country] = { count: 0, journals: [] };
    countries[country].count++;
    countries[country].journals.push({
      t:  at("Journal title"),
      i:  at("ISSN"),
      e:  at("EISSN"),
      u:  at("URL in DOAJ"),
      l:  at("Journal license"),
      a:  at("APC"),
      ...splitApcAmount(at("APC amount")),
    });
  }, hdrs => {
    idx = buildIdx(hdrs);
    return new Set(Object.values(idx).filter(i => i >= 0));
  });

  if (!idx) idx = buildIdx(headers);
  if (idx["Country of publisher"] < 0) throw new Error("Could not locate 'Country of publisher' column");

  const meta = {
    cachedAt:  new Date().toISOString(),
    totalRows,
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
    if (r.status === 404) return 0;          // ISSN inconnu de Crossref : vraie réponse
    if (!r.ok) return null;                  // 429 / 5xx / coupure : on ne sait pas
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

// Budget de sous-requêtes d'une invocation Worker (50 sur le plan gratuit).
// Au-delà, chaque fetch() lève : le build de juin 2026 n'avait ainsi récolté que
// 37 revues sur 881, tout le reste étant enregistré comme « inconnu ».
// On traite donc une tranche par passage, en faisant tourner un curseur, et on
// FUSIONNE : un échec ne doit jamais effacer une valeur déjà connue.
// 20 revues = au pire 40 requêtes Crossref (eISSN puis ISSN), auxquelles
// s'ajoutent les 2 téléchargements du CSV lancés par le même cron.
const ENRICH_LOOKUPS_PER_RUN = 20;
const ENRICHMENT_CURSOR_KEY  = 'enrichment_cursor';

async function buildEnrichmentCache(env) {
  const raw = await env.DOAJ_KV.get(CACHE_KEY);
  if (!raw) throw new Error('African journals KV not found — run /refresh first');
  const journals = JSON.parse(raw);

  const existingRaw = await env.DOAJ_KV.get(ENRICHMENT_KEY);
  const existing = existingRaw ? JSON.parse(existingRaw) : {};
  const prevCrossref = existing.crossref || {};

  const cursorRaw = await env.DOAJ_KV.get(ENRICHMENT_CURSOR_KEY);
  const start = Math.max(0, parseInt(cursorRaw, 10) || 0) % Math.max(1, journals.length);
  const slice = journals.slice(start, start + ENRICH_LOOKUPS_PER_RUN);
  const next  = (start + slice.length) % Math.max(1, journals.length);

  const fresh = {};

  // ── Crossref : une requête par revue (pas d'endpoint groupé) ──
  await batchRun(slice, 3, async j => {
    const ei = normIssnW(j['EISSN'] || '');
    const pi = normIssnW(j['ISSN']  || '');
    if (!ei && !pi) return;
    let count = null;
    if (ei) { count = await crCount(ei); fresh[ei] = count; }
    if ((!count || count === 0) && pi && pi !== ei) {
      count = await crCount(pi); fresh[pi] = count;
    }
  });

  // OpenAlex / OpenCitations : non interrogés ici — les IP cloud sont bloquées
  // par leur offre gratuite. Ces données viennent des navigateurs, via
  // /report-oa et /report-oc, et doivent donc être préservées telles quelles.
  const crossref = { ...prevCrossref };
  for (const [k, v] of Object.entries(fresh)) if (v !== null) crossref[k] = v;

  const meta = {
    generated:      new Date().toISOString(),
    journals:       journals.length,
    refreshedFrom:  start,
    refreshed:      slice.length,
    foundCrossref:  Object.values(crossref).filter(v => v && v > 0).length,
    foundOpenalex:  Object.keys(existing.openalex || {}).length,
  };

  await env.DOAJ_KV.put(
    ENRICHMENT_KEY,
    JSON.stringify({ ...existing, ...meta, crossref }),
    { expirationTtl: KV_TTL }
  );
  await env.DOAJ_KV.put(ENRICHMENT_META_KEY, JSON.stringify(meta), { expirationTtl: KV_TTL });
  await env.DOAJ_KV.put(ENRICHMENT_CURSOR_KEY, String(next), { expirationTtl: KV_TTL });
  return meta;
}

/**
 * Écrit l'objet d'enrichissement dans KV uniquement si `next` diffère de ce qui
 * s'y trouve déjà. Les trois routes /report-* reçoivent à chaque visite des
 * données que le cache connaît déjà : sans cette comparaison, un millier de
 * visiteurs suffit à épuiser le quota d'écritures KV de la journée.
 * Renvoie true si une écriture a eu lieu.
 */
async function putEnrichmentIfChanged(env, existing, next) {
  const before = JSON.stringify(existing);
  const after  = JSON.stringify(next);
  if (before === after) return false;
  await env.DOAJ_KV.put(ENRICHMENT_KEY, after, { expirationTtl: KV_TTL });
  return true;
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
        if (!Object.keys(incoming).length) {
          return new Response(JSON.stringify({ ok: true, stored: 0, wrote: false }), { headers: CORS });
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
        const wrote = await putEnrichmentIfChanged(env, existing, { ...existing, openalex: mergedOA });
        return new Response(JSON.stringify({ ok: true, stored: Object.keys(clean).length, wrote }), { headers: CORS });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false }), { status: 500, headers: CORS });
      }
    }

    // /report-oc (POST) — browser reports resolved OpenCitations hits for KV caching.
    // Without this route the frontend's report call 404s and the OpenCitations
    // lookups are redone from scratch by every single visitor.
    if (url.pathname === "/report-oc" && request.method === "POST") {
      try {
        const incoming = await request.json();
        if (!incoming || typeof incoming !== "object") {
          return new Response(JSON.stringify({ ok: false }), { status: 400, headers: CORS });
        }
        if (!Object.keys(incoming).length) {
          return new Response(JSON.stringify({ ok: true, stored: 0, wrote: false }), { headers: CORS });
        }
        const clean = {};
        for (const [issn, val] of Object.entries(incoming)) {
          if (!/^\d{4}-[\dXx]{4}$/i.test(issn)) continue;
          clean[issn] = val === true;
        }
        const existingRaw = await env.DOAJ_KV.get(ENRICHMENT_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        // Merge: incoming data wins, except that a previously recorded hit (true)
        // is never downgraded to a miss. Read-modify-write, so two simultaneous
        // reports can lose one update — harmless, the next visitor reports again.
        const prevOC = existing.opencitations || {};
        const mergedOC = { ...prevOC, ...clean };
        for (const [k, v] of Object.entries(prevOC)) if (v === true) mergedOC[k] = true;
        const wrote = await putEnrichmentIfChanged(env, existing, { ...existing, opencitations: mergedOC });
        return new Response(JSON.stringify({ ok: true, stored: Object.keys(clean).length, wrote }), { headers: CORS });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false }), { status: 500, headers: CORS });
      }
    }

    // /report-cr (POST) — browser reports the Crossref counts it resolved.
    // Le Worker ne peut en interroger qu'une quarantaine par passage (budget de
    // sous-requêtes) ; les navigateurs, eux, les récupèrent déjà carte par carte.
    if (url.pathname === "/report-cr" && request.method === "POST") {
      try {
        const incoming = await request.json();
        if (!incoming || typeof incoming !== "object") {
          return new Response(JSON.stringify({ ok: false }), { status: 400, headers: CORS });
        }
        const clean = {};
        for (const [issn, val] of Object.entries(incoming)) {
          if (!/^\d{4}-[\dXx]{4}$/i.test(issn)) continue;
          if (typeof val === "number" && Number.isFinite(val) && val >= 0) clean[issn] = Math.trunc(val);
        }
        if (!Object.keys(clean).length) {
          return new Response(JSON.stringify({ ok: true, stored: 0 }), { headers: CORS });
        }
        const existingRaw = await env.DOAJ_KV.get(ENRICHMENT_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        const merged = { ...(existing.crossref || {}), ...clean };
        const wrote = await putEnrichmentIfChanged(env, existing, { ...existing, crossref: merged });
        return new Response(JSON.stringify({ ok: true, stored: Object.keys(clean).length, wrote }), { headers: CORS });
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
          // Le cache d'enrichissement est complété en continu par les navigateurs
          // (/report-oa, /report-oc, /report-cr) et par le cron hebdomadaire.
          // 24 h de cache ferme signifiait qu'une reconstruction restait invisible
          // une journée entière. stale-while-revalidate garde l'affichage instantané
          // (servi depuis le cache) tout en rafraîchissant en arrière-plan.
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=82800",
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

  // ── Cron handler (weekly — schedule declared in wrangler.toml) ──────────────
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
