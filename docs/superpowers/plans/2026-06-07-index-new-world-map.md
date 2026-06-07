# World Map OA Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `index-new.html` — dashboard mondial Leaflet choroplèthe + graphique ECharts APC médian par pays, inspiré du design de `index.html`.

**Architecture:** SPA statique, fichier unique. CSV DOAJ global via corsproxy.io → PapaParse streaming → agrégation `Map<country, {count, journals[], apcEur[]}>` → Leaflet choroplèthe GeoJSON + ECharts bar chart. Fallback upload manuel si CORS échoue.

**Tech Stack:** Leaflet 1.9.4, ECharts 5.4.3, PapaParse 5.4.1, flag-icons 7.2.3, Inter + Material Symbols, open.er-api.com, corsproxy.io

---

### Task 1: HTML shell, CSS variables, loading overlay

**Files:**
- Create: `index-new.html`

- [ ] **Step 1: Créer le fichier**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#07080b">
  <title>Observatoire mondial des revues en libre accès</title>
  <link rel="icon" type="image/png" href="https://azilan.me/fav.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,500,0,0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/css/flag-icons.min.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    :root {
      --bg:#f8fafc; --text:#0f172a; --muted:#64748b;
      --card:rgba(255,255,255,0.75); --card-solid:#ffffff;
      --card-border:rgba(15,23,42,0.10); --accent:#2563eb;
      --select-bg:#f1f5f9; --chip-bg:rgba(15,23,42,0.06);
      --blur:blur(16px) saturate(1.6); --shadow:0 4px 24px rgba(15,23,42,0.08);
      --danger:#ef4444;
    }
    html.dark {
      --bg:#07080b; --text:#f5f7fb; --muted:#8892a4;
      --card:rgba(255,255,255,0.04); --card-solid:#0f1117;
      --card-border:rgba(255,255,255,0.08); --accent:#69a8ff;
      --select-bg:rgba(255,255,255,0.06); --chip-bg:rgba(255,255,255,0.07);
      --blur:blur(20px) saturate(1.8); --shadow:0 4px 32px rgba(0,0,0,0.45);
    }
    *,*::before,*::after{box-sizing:border-box;}
    html,body{margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100%;overflow-x:hidden;transition:background .3s,color .3s;}
    html{scroll-behavior:smooth;scrollbar-width:auto;scrollbar-color:var(--accent) transparent;}
    ::-webkit-scrollbar{width:10px;}::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:var(--accent);border-radius:999px;border:2px solid transparent;background-clip:padding-box;}
    a{color:inherit;text-decoration:none;transition:color .2s;}
    .container{max-width:1280px;margin:0 auto;padding:0 24px;}
    .glass{backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--card-border);background:var(--card);}
    .section-shell{border-radius:24px;padding:24px;margin-top:20px;}
    .section-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:0 10px;min-height:26px;margin-bottom:10px;border-radius:999px;border:1px solid var(--card-border);background:rgba(255,255,255,.04);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.16em;}
    .section-title{font-size:clamp(1.2rem,2vw,1.7rem);font-weight:780;letter-spacing:-.03em;margin:0 0 8px;display:flex;align-items:center;gap:8px;}
    .section-lead{color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:18px;}
    .section-icon{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;flex-shrink:0;}
    .section-icon .material-symbols-outlined{font-size:18px;line-height:1;}
    .muted{color:var(--muted);}
    .hidden{display:none!important;}
    .btn{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit;box-shadow:0 6px 18px rgba(37,99,235,.3);transition:transform .15s,box-shadow .15s;text-decoration:none;}
    .btn:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(37,99,235,.45);}
    .icon-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:999px;border:1px solid var(--card-border);background:var(--card);cursor:pointer;transition:border-color .18s,background .18s;}
    .icon-btn:hover{border-color:var(--accent);background:rgba(37,99,235,.08);}
    .icon-btn .material-symbols-outlined{font-size:20px;}
    /* Header */
    .site-header{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--card-border);background:var(--card);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);}
    .site-topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;}
    .brand-row{display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;}
    .brand-dot{width:10px;height:10px;border-radius:999px;background:#79ffa8;animation:brandPulse 1.8s infinite ease-in-out;}
    @keyframes brandPulse{0%{opacity:.65;transform:scale(.95);box-shadow:0 0 0 0 rgba(121,255,168,.35);}50%{opacity:1;transform:scale(1.08);box-shadow:0 0 0 8px rgba(121,255,168,0);}100%{opacity:.65;transform:scale(.95);box-shadow:0 0 0 0 rgba(121,255,168,0);}}
    .brand-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:var(--muted);}
    .brand-status{display:inline-flex;align-items:center;padding:0 10px;min-height:26px;border-radius:999px;border:1px solid var(--card-border);background:rgba(255,255,255,.05);font-size:12px;font-weight:700;color:var(--text);}
    .site-title{font-size:clamp(17px,2.2vw,28px);font-weight:800;letter-spacing:-.04em;margin:0;}
    .header-actions{display:flex;align-items:center;gap:10px;flex-shrink:0;}
    .back-link{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;border:1.5px solid var(--card-border);background:var(--card);color:var(--muted);font-size:12px;font-weight:600;transition:border-color .18s,color .18s;}
    .back-link:hover{border-color:var(--accent);color:var(--accent);}
    .back-link .material-symbols-outlined{font-size:15px;}
    /* Footer */
    .site-footer{margin-top:32px;padding:24px 0;border-top:1px solid var(--card-border);font-size:12px;color:var(--muted);line-height:1.7;}
    .footer-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;}
    .footer-col-title{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;color:var(--text);}
    .footer-link{color:var(--accent);}
    /* Loading */
    #loading-overlay{position:fixed;inset:0;z-index:200;background:var(--bg);display:flex;align-items:center;justify-content:center;transition:opacity .4s;}
    #loading-overlay.hidden{opacity:0;pointer-events:none;}
    .loading-card{background:var(--card);border:1px solid var(--card-border);border-radius:24px;padding:38px 48px;display:flex;flex-direction:column;align-items:center;gap:18px;box-shadow:var(--shadow);min-width:300px;backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);}
    .loading-bars{display:flex;align-items:flex-end;gap:7px;height:52px;}
    .loading-bar{width:10px;border-radius:4px 4px 0 0;background:var(--accent);height:var(--h);animation:bar-pulse 1s ease-in-out infinite alternate;animation-delay:var(--d);}
    @keyframes bar-pulse{from{opacity:.3;transform:scaleY(.4);}to{opacity:1;transform:scaleY(1);}}
    .loading-title{font-weight:800;font-size:16px;}
    .loading-status{font-size:12.5px;color:var(--muted);min-height:17px;}
    /* Fallback modal */
    .modal-overlay{position:fixed;inset:0;z-index:150;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;}
    .modal-box{background:var(--card-solid);border:1px solid var(--card-border);border-radius:20px;padding:28px;width:min(520px,92vw);box-shadow:var(--shadow);color:var(--text);}
    .modal-title{font-weight:800;font-size:18px;margin-bottom:8px;}
    .modal-lead{color:var(--muted);font-size:13.5px;line-height:1.55;margin-bottom:18px;}
    .file-drop{border:2px dashed var(--card-border);border-radius:14px;padding:28px;text-align:center;color:var(--muted);cursor:pointer;transition:border-color .18s;}
    .file-drop:hover{border-color:var(--accent);}
    .file-drop .material-symbols-outlined{font-size:36px;display:block;margin-bottom:8px;}
    /* Map */
    #map-wrap{position:relative;}
    #world-map{height:540px;border-radius:18px;overflow:hidden;border:1px solid var(--card-border);}
    .map-legend{position:absolute;bottom:18px;left:18px;z-index:400;background:var(--card-solid);border:1px solid var(--card-border);border-radius:12px;padding:10px 14px;font-size:11.5px;color:var(--text);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);}
    .map-legend-title{font-weight:700;margin-bottom:6px;}
    .legend-row{display:flex;align-items:center;gap:8px;margin-bottom:3px;}
    .legend-swatch{width:14px;height:14px;border-radius:3px;flex-shrink:0;}
    .leaflet-container{background:var(--bg)!important;font-family:Inter,sans-serif;}
    .leaflet-control-attribution{display:none;}
    /* Tooltip */
    #map-tooltip{position:fixed;z-index:500;pointer-events:none;background:var(--card-solid);border:1px solid var(--card-border);border-radius:12px;padding:10px 14px;box-shadow:0 8px 28px rgba(0,0,0,.18);font-size:13px;min-width:180px;max-width:260px;display:none;}
    .tt-country{font-weight:800;font-size:14px;margin-bottom:4px;display:flex;align-items:center;gap:6px;}
    .tt-row{display:flex;justify-content:space-between;gap:16px;color:var(--muted);font-size:12px;margin-top:2px;}
    .tt-val{font-weight:700;color:var(--text);}
    /* Drawer */
    #country-drawer{position:fixed;top:0;right:0;bottom:0;z-index:300;width:min(380px,92vw);background:var(--card-solid);border-left:1px solid var(--card-border);box-shadow:-8px 0 40px rgba(0,0,0,.18);transform:translateX(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;overflow:hidden;}
    #country-drawer.open{transform:translateX(0);}
    .drawer-header{padding:18px 18px 14px;border-bottom:1px solid var(--card-border);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-shrink:0;}
    .drawer-country{font-weight:800;font-size:18px;display:flex;align-items:center;gap:8px;}
    .drawer-stats{display:flex;gap:16px;margin-top:6px;flex-wrap:wrap;}
    .drawer-stat{font-size:12px;color:var(--muted);}
    .drawer-stat strong{color:var(--text);}
    .drawer-close{background:none;border:none;cursor:pointer;color:var(--muted);font-size:22px;line-height:1;padding:4px;border-radius:8px;flex-shrink:0;transition:color .15s,background .15s;}
    .drawer-close:hover{color:var(--text);background:var(--chip-bg);}
    .drawer-body{flex:1;overflow-y:auto;padding:14px 18px;}
    .drawer-journal{padding:10px 12px;border-radius:12px;border:1px solid var(--card-border);background:var(--card);margin-bottom:8px;}
    .drawer-journal-title{font-weight:700;font-size:13.5px;line-height:1.35;margin-bottom:4px;}
    .drawer-journal-title a{color:var(--accent);}
    .drawer-journal-title a:hover{text-decoration:underline;}
    .drawer-journal-meta{font-size:11.5px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px;}
    .drawer-empty{color:var(--muted);font-size:13px;text-align:center;padding:32px 0;}
    #drawer-backdrop{position:fixed;inset:0;z-index:299;background:rgba(0,0,0,.3);display:none;}
    #drawer-backdrop.open{display:block;}
    /* APC chart */
    #apc-chart{width:100%;border-radius:14px;overflow:hidden;}
    .chart-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
    .chart-controls label{font-size:13px;color:var(--muted);font-weight:600;}
    .chart-controls select{padding:8px 12px;border-radius:10px;border:1.5px solid var(--card-border);background:var(--select-bg);color:var(--text);font-size:13px;font-family:inherit;outline:none;cursor:pointer;}
    /* Dark grid + mobile */
    html.dark::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:26px 26px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.35),transparent 78%);opacity:.38;z-index:0;}
    body{position:relative;}
    body>*{position:relative;z-index:1;}
    html:not(.dark)::before{display:none!important;}
    @media(max-width:700px){
      .container{padding:0 14px;}
      .section-shell{padding:16px 14px;border-radius:18px;}
      #world-map{height:340px;}
      .footer-grid{grid-template-columns:1fr;gap:14px;}
      .site-topbar{flex-direction:column;align-items:flex-start;gap:10px;}
      #country-drawer{width:100vw;border-left:none;border-top:1px solid var(--card-border);top:auto;height:70vh;transform:translateY(100%);}
      #country-drawer.open{transform:translateY(0);}
    }
  </style>
</head>
<body>

<div id="loading-overlay">
  <div class="loading-card">
    <div class="loading-bars">
      <div class="loading-bar" style="--h:28px;--d:0s"></div>
      <div class="loading-bar" style="--h:42px;--d:.1s"></div>
      <div class="loading-bar" style="--h:52px;--d:.2s"></div>
      <div class="loading-bar" style="--h:38px;--d:.3s"></div>
      <div class="loading-bar" style="--h:46px;--d:.4s"></div>
    </div>
    <div class="loading-title">Chargement des données…</div>
    <div class="loading-status" id="loading-status">Connexion à DOAJ…</div>
  </div>
</div>

<div id="fallback-modal" class="modal-overlay hidden">
  <div class="modal-box">
    <div class="modal-title">⚠ Chargement automatique indisponible</div>
    <div class="modal-lead">Le chargement direct du CSV DOAJ a échoué (CORS ou réseau). Téléchargez le fichier manuellement puis sélectionnez-le ci-dessous.</div>
    <a href="https://doaj.org/csv/journals" target="_blank" rel="noopener" class="btn" style="margin-bottom:16px;">
      <span class="material-symbols-outlined">download</span>Télécharger le CSV DOAJ
    </a>
    <label class="file-drop" for="csv-file-input">
      <span class="material-symbols-outlined">upload_file</span>
      Cliquer pour sélectionner le fichier CSV téléchargé
      <input type="file" id="csv-file-input" accept=".csv" style="display:none">
    </label>
  </div>
</div>

<div id="map-tooltip">
  <div class="tt-country" id="tt-country"></div>
  <div class="tt-row"><span>Revues</span><span class="tt-val" id="tt-count">—</span></div>
  <div class="tt-row"><span>APC médian</span><span class="tt-val" id="tt-apc">—</span></div>
</div>

<div id="drawer-backdrop"></div>
<div id="country-drawer">
  <div class="drawer-header">
    <div>
      <div class="drawer-country" id="drawer-country"></div>
      <div class="drawer-stats">
        <div class="drawer-stat">Revues : <strong id="drawer-count">—</strong></div>
        <div class="drawer-stat">APC médian : <strong id="drawer-apc">—</strong></div>
      </div>
    </div>
    <button class="drawer-close" id="drawer-close" aria-label="Fermer">×</button>
  </div>
  <div class="drawer-body" id="drawer-body"></div>
</div>

<header class="site-header">
  <div class="container site-topbar">
    <div>
      <div class="brand-row">
        <span class="brand-dot" aria-hidden="true"></span>
        <span class="brand-kicker">DOAJ · Monde · Libre accès</span>
        <span class="brand-status">
          <a href="https://doaj.org/docs/journal-csv" target="_blank" rel="noopener"
             style="color:inherit;border-bottom:1px dashed rgba(37,99,235,.4);">Données DOAJ</a>
        </span>
      </div>
      <h1 class="site-title">Observatoire mondial des revues en libre accès</h1>
      <div class="muted" style="font-size:13px;margin-top:4px;">
        <span id="total-count">—</span> revues indexées dans le monde
      </div>
    </div>
    <div class="header-actions">
      <a href="index.html" class="back-link">
        <span class="material-symbols-outlined">arrow_back</span>Afrique
      </a>
      <button id="toggle-theme" class="icon-btn" aria-label="Mode sombre/clair">
        <span class="material-symbols-outlined">dark_mode</span>
      </button>
    </div>
  </div>
</header>

<main class="container" style="padding-top:24px;padding-bottom:48px;">

  <section class="glass section-shell" id="section-map">
    <div class="section-eyebrow">Cartographie</div>
    <div class="section-title">
      <span class="section-icon" style="color:#3b82f6;background:rgba(59,130,246,.13)">
        <span class="material-symbols-outlined">public</span>
      </span>
      Revues OA par pays
    </div>
    <div class="section-lead">Nombre de revues en libre accès indexées dans le DOAJ, par pays de l'éditeur. Survolez pour les détails, cliquez pour voir la liste des revues.</div>
    <div id="map-wrap">
      <div id="world-map"></div>
      <div class="map-legend" id="map-legend"></div>
    </div>
  </section>

  <section class="glass section-shell" id="section-apc">
    <div class="section-eyebrow">Coûts</div>
    <div class="section-title">
      <span class="section-icon" style="color:#ef4444;background:rgba(239,68,68,.13)">
        <span class="material-symbols-outlined">euro</span>
      </span>
      Coût médian des APC par pays (€)
    </div>
    <div class="section-lead">Médiane des frais de publication convertis en euros, pour les pays disposant d'au moins N revues avec APC déclaré.</div>
    <div class="chart-controls">
      <label for="apc-min-journals">Pays avec au moins</label>
      <select id="apc-min-journals">
        <option value="1">1 revue avec APC</option>
        <option value="2">2 revues avec APC</option>
        <option value="5" selected>5 revues avec APC</option>
        <option value="10">10 revues avec APC</option>
      </select>
    </div>
    <div id="apc-chart"></div>
  </section>

</main>

<footer class="container site-footer">
  <div class="footer-grid">
    <div>
      <div class="footer-col-title">Observatoire</div>
      <div><strong style="color:var(--text);">V1</strong> — 2026 · Données DOAJ mises à jour mensuellement.</div>
      <div style="margin-top:4px;">Proposé par <a href="https://www.azilan.me" target="_blank" rel="noopener" class="footer-link">Innocent Azilan</a></div>
      <div>Licence : <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" target="_blank" rel="noopener" class="footer-link">CC BY 4.0</a></div>
    </div>
    <div>
      <div class="footer-col-title">Données</div>
      <div><a href="https://doaj.org" target="_blank" rel="noopener" class="footer-link">DOAJ</a> — Directory of Open Access Journals · <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener" class="footer-link">CC0</a></div>
      <div><a href="https://www.naturalearthdata.com" target="_blank" rel="noopener" class="footer-link">Natural Earth</a> — Frontières mondiales · Domaine public</div>
      <div><a href="https://corsproxy.io" target="_blank" rel="noopener" class="footer-link">corsproxy.io</a> — Proxy CORS</div>
      <div><a href="https://open.er-api.com" target="_blank" rel="noopener" class="footer-link">Open Exchange Rates</a> — Taux de change</div>
    </div>
    <div>
      <div class="footer-col-title">Bibliothèques</div>
      <div><a href="https://leafletjs.com" target="_blank" rel="noopener" class="footer-link">Leaflet.js</a> — Cartographie · BSD-2</div>
      <div><a href="https://echarts.apache.org" target="_blank" rel="noopener" class="footer-link">Apache ECharts</a> — Visualisations · Apache 2.0</div>
      <div><a href="https://www.papaparse.com" target="_blank" rel="noopener" class="footer-link">PapaParse</a> — Parsing CSV · MIT</div>
    </div>
  </div>
</footer>

<script>
// ── Theme ──────────────────────────────────────────────────────────────
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if (prefersDark) document.documentElement.classList.add('dark');

// ── Constants ──────────────────────────────────────────────────────────
const DOAJ_CSV_URL  = 'https://corsproxy.io/?url=https%3A%2F%2Fdoaj.org%2Fcsv%2Fjournals';
const ER_API_URL    = 'https://open.er-api.com/v6/latest/EUR';
const GEOJSON_URL   = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';
const FETCH_TIMEOUT = 45000;

const COLS = {
  title:'Journal title', country:'Country of publisher',
  issn:'ISSN', eissn:'EISSN', url:'URL in DOAJ',
  license:'Journal license', apc:'APC',
  apcAmt:'APC amount', apcCur:'APC amount currency',
};

const COUNTRY_NAME_MAP = {
  'United States of America':'United States',
  'South Korea':'Korea, Republic of',
  'North Korea':"Korea, Democratic People's Republic of",
  'Russia':'Russian Federation',
  'Iran':'Iran, Islamic Republic of',
  'Syria':'Syrian Arab Republic',
  'Tanzania':'Tanzania, United Republic of',
  'Venezuela':'Venezuela, Bolivarian Republic of',
  'Bolivia':'Bolivia, Plurinational State of',
  'Czech Republic':'Czechia',
  'Macedonia':'North Macedonia',
  'Moldova':'Moldova, Republic of',
  'Vietnam':'Viet Nam',
  'Laos':"Lao People's Democratic Republic",
  'Palestine':'Palestinian Territory, Occupied',
  'W. Sahara':null,
  'Dem. Rep. Congo':'Democratic Republic of the Congo',
  'S. Sudan':'South Sudan',
  'Bosnia and Herz.':'Bosnia and Herzegovina',
  'Dominican Rep.':'Dominican Republic',
  'Eq. Guinea':'Equatorial Guinea',
  'Solomon Is.':'Solomon Islands',
  'Central African Rep.':'Central African Republic',
  'Fr. S. Antarctic Lands':null,
  'Timor-Leste':'East Timor',
};

const ISO2 = {
  'France':'fr','United States':'us','United Kingdom':'gb','Germany':'de',
  'Brazil':'br','India':'in','China':'cn','Russia':'ru','Japan':'jp',
  'Spain':'es','Italy':'it','Poland':'pl','Netherlands':'nl','Australia':'au',
  'Canada':'ca','Argentina':'ar','Mexico':'mx','South Africa':'za',
  'Nigeria':'ng','Egypt':'eg','Kenya':'ke','Iran, Islamic Republic of':'ir',
  'Turkey':'tr','Indonesia':'id','Pakistan':'pk','Colombia':'co',
  'Romania':'ro','Ukraine':'ua','Portugal':'pt','Sweden':'se',
  'Switzerland':'ch','Austria':'at','Belgium':'be','Czechia':'cz',
  'Slovakia':'sk','Hungary':'hu','Croatia':'hr','Serbia':'rs',
  'Greece':'gr','Finland':'fi','Denmark':'dk','Norway':'no',
  'Algeria':'dz','Morocco':'ma','Tunisia':'tn','Ethiopia':'et',
  'Ghana':'gh','Chile':'cl','Peru':'pe','Cuba':'cu','Ecuador':'ec',
  'Uruguay':'uy','Saudi Arabia':'sa','United Arab Emirates':'ae',
  'Israel':'il','Jordan':'jo','Lebanon':'lb','Iraq':'iq',
  'Bangladesh':'bd','Sri Lanka':'lk','Nepal':'np','Thailand':'th',
  'Malaysia':'my','Philippines':'ph','Viet Nam':'vn',
  'Kazakhstan':'kz','Korea, Republic of':'kr','Singapore':'sg',
  'New Zealand':'nz','Tanzania, United Republic of':'tz',
  'Venezuela, Bolivarian Republic of':'ve',
};

const COLOR_SCALE = [
  {min:0,   max:0,        color:'#334155', label:'Aucune revue'},
  {min:1,   max:10,       color:'#bfdbfe', label:'1–10'},
  {min:11,  max:50,       color:'#60a5fa', label:'11–50'},
  {min:51,  max:200,      color:'2563eb',  label:'51–200'},
  {min:201, max:500,      color:'#1e40af', label:'201–500'},
  {min:501, max:Infinity, color:'#1e3a8a', label:'500+'},
];
// fix typo: 51-200 color missing #
COLOR_SCALE[3].color = '#2563eb';

// ── State ──────────────────────────────────────────────────────────────
let countryStats  = new Map();  // Map<string, {count,journals[],apcEur[]}>
let exchangeRates = {};
let leafletMap    = null;
let geoLayer      = null;
let tileLayerRef  = null;
let apcChart      = null;

// ── Helpers ────────────────────────────────────────────────────────────
function setStatus(m){ const e=document.getElementById('loading-status'); if(e) e.textContent=m; }
function median(arr){ if(!arr.length) return null; const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2===0?(s[m-1]+s[m])/2:s[m]; }
function fmtEur(v){ return v!==null ? Math.round(v).toLocaleString('fr')+' €' : 'Sans APC'; }
function flagHtml(c){ const i=ISO2[c]; return i?`<span class="fi fi-${i}" style="border-radius:2px;flex-shrink:0;"></span>`:''; }
function isDark(){ return document.documentElement.classList.contains('dark'); }

function toEur(amount, currency){
  if(!amount||!currency) return null;
  const n=parseFloat(String(amount).replace(/[^\d.]/g,''));
  if(isNaN(n)||n<=0) return null;
  const cur=currency.trim().toUpperCase();
  if(cur==='EUR') return n;
  const rate=exchangeRates[cur];
  if(!rate) return null;
  return Math.round(n/rate);
}

function resolveCountry(geoName){
  if(COUNTRY_NAME_MAP[geoName]===null) return null;
  return COUNTRY_NAME_MAP[geoName]||geoName;
}

function getColor(count){
  if(!count) return isDark()?'#1e293b':'#e2e8f0';
  for(const b of COLOR_SCALE.slice(1)){ if(count>=b.min&&count<=b.max) return b.color; }
  return COLOR_SCALE[COLOR_SCALE.length-1].color;
}

// ── Exchange rates ─────────────────────────────────────────────────────
async function fetchExchangeRates(){
  try{
    const res=await fetch(ER_API_URL);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data=await res.json();
    exchangeRates=data.rates||{};
  }catch(e){ console.warn('Exchange rates unavailable:',e); }
}

// ── CSV row ────────────────────────────────────────────────────────────
function processRow(row){
  const country=(row[COLS.country]||'').trim();
  if(!country) return;
  const journal={
    title:(row[COLS.title]||'').trim(),
    issn:(row[COLS.issn]||'').trim(),
    eissn:(row[COLS.eissn]||'').trim(),
    url:(row[COLS.url]||'').trim(),
    license:(row[COLS.license]||'').trim(),
    apc:(row[COLS.apc]||'').trim(),
    apcAmt:(row[COLS.apcAmt]||'').trim(),
    apcCur:(row[COLS.apcCur]||'').trim(),
  };
  if(!countryStats.has(country)) countryStats.set(country,{count:0,journals:[],apcEur:[]});
  const stat=countryStats.get(country);
  stat.count++;
  stat.journals.push(journal);
  if(journal.apc==='Yes'){
    const eur=toEur(journal.apcAmt,journal.apcCur);
    if(eur!==null) stat.apcEur.push(eur);
  }
}

// ── CSV fetch ─────────────────────────────────────────────────────────
async function fetchCSV(){
  return new Promise((resolve,reject)=>{
    const ctrl=new AbortController();
    const timer=setTimeout(()=>{ctrl.abort();reject(new Error('timeout'));},FETCH_TIMEOUT);
    fetch(DOAJ_CSV_URL,{signal:ctrl.signal})
      .then(res=>{
        if(!res.ok) throw new Error('HTTP '+res.status);
        clearTimeout(timer);
        let n=0;
        Papa.parse(res.body,{
          download:false, header:true, skipEmptyLines:true, worker:false,
          step(r){ processRow(r.data); n++; if(n%2000===0) setStatus(n.toLocaleString('fr')+' revues chargées…'); },
          complete(){ resolve(n); },
          error(e){ reject(e); },
        });
      })
      .catch(e=>{ clearTimeout(timer); reject(e); });
  });
}

// ── Fallback upload ────────────────────────────────────────────────────
function setupFallback(){
  document.getElementById('fallback-modal').classList.remove('hidden');
  document.getElementById('csv-file-input').addEventListener('change',async e=>{
    const file=e.target.files[0]; if(!file) return;
    document.getElementById('fallback-modal').classList.add('hidden');
    document.getElementById('loading-overlay').classList.remove('hidden');
    setStatus('Lecture du fichier…');
    countryStats=new Map();
    await new Promise((res,rej)=>{
      Papa.parse(file,{
        header:true, skipEmptyLines:true,
        step(r){ processRow(r.data); },
        complete(){ res(); }, error(e){ rej(e); },
      });
    });
    onDataReady();
  });
}

// ── Tooltip ────────────────────────────────────────────────────────────
const tooltipEl=document.getElementById('map-tooltip');
function showTooltip(e,geoName,doajName,stat){
  const count=stat?stat.count:0;
  const med=stat?median(stat.apcEur):null;
  document.getElementById('tt-country').innerHTML=flagHtml(doajName||geoName)+(doajName||geoName);
  document.getElementById('tt-count').textContent=count?count.toLocaleString('fr'):'0';
  document.getElementById('tt-apc').textContent=count?fmtEur(med):'—';
  tooltipEl.style.display='block';
  posTooltip(e.originalEvent);
}
function posTooltip(e){
  const x=e.clientX+14,y=e.clientY-10;
  tooltipEl.style.left=Math.min(x,window.innerWidth-280)+'px';
  tooltipEl.style.top=Math.min(y,window.innerHeight-120)+'px';
}
function hideTooltip(){ tooltipEl.style.display='none'; }
document.addEventListener('mousemove',e=>{ if(tooltipEl.style.display==='block') posTooltip(e); });

// ── Drawer ─────────────────────────────────────────────────────────────
const drawer=document.getElementById('country-drawer');
const backdrop=document.getElementById('drawer-backdrop');
function openDrawer(country,stat){
  const count=stat?stat.count:0;
  const med=stat?median(stat.apcEur):null;
  document.getElementById('drawer-country').innerHTML=flagHtml(country)+' '+country;
  document.getElementById('drawer-count').textContent=count.toLocaleString('fr');
  document.getElementById('drawer-apc').textContent=fmtEur(med);
  const body=document.getElementById('drawer-body');
  if(!stat||!stat.journals.length){
    body.innerHTML='<div class="drawer-empty">Aucune revue DOAJ dans ce pays.</div>';
  } else {
    body.innerHTML=stat.journals
      .sort((a,b)=>a.title.localeCompare(b.title))
      .map(j=>{
        const ids=[j.issn,j.eissn].filter(Boolean).join(' / ');
        const apcStr=j.apc==='Yes'?(j.apcAmt?`APC : ${j.apcAmt} ${j.apcCur}`:'APC : montant non précisé'):'Sans APC';
        return `<div class="drawer-journal">
          <div class="drawer-journal-title">${j.url?`<a href="${j.url}" target="_blank" rel="noopener">${j.title||'(sans titre)'}</a>`:(j.title||'(sans titre)')}</div>
          <div class="drawer-journal-meta">${ids?`<span>${ids}</span>`:''} ${j.license?`<span>${j.license}</span>`:''} <span>${apcStr}</span></div>
        </div>`;
      }).join('');
  }
  drawer.classList.add('open');
  backdrop.classList.add('open');
}
function closeDrawer(){ drawer.classList.remove('open'); backdrop.classList.remove('open'); }
document.getElementById('drawer-close').addEventListener('click',closeDrawer);
backdrop.addEventListener('click',closeDrawer);

// ── Map ────────────────────────────────────────────────────────────────
function mapStyle(feature){
  const name=resolveCountry(feature.properties.name);
  const count=name&&countryStats.has(name)?countryStats.get(name).count:0;
  return {fillColor:getColor(count),fillOpacity:0.85,color:isDark()?'#0f172a':'#ffffff',weight:0.5};
}
async function initMap(){
  leafletMap=L.map('world-map',{center:[20,10],zoom:2,zoomControl:true,attributionControl:false});
  const darkTile ='https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const lightTile='https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  tileLayerRef=L.tileLayer(isDark()?darkTile:lightTile,{subdomains:'abcd',maxZoom:8}).addTo(leafletMap);
  window._mapTiles={dark:darkTile,light:lightTile};

  const geoRes=await fetch(GEOJSON_URL);
  const geoData=await geoRes.json();
  geoLayer=L.geoJSON(geoData,{
    style:mapStyle,
    onEachFeature(feature,layer){
      const geoName=feature.properties.name;
      const doajName=resolveCountry(geoName);
      const stat=doajName?countryStats.get(doajName):null;
      layer.on({
        mouseover(e){ showTooltip(e,geoName,doajName,stat); },
        mouseout(){ hideTooltip(); },
        click(){ openDrawer(doajName||geoName,stat); },
      });
    },
  }).addTo(leafletMap);

  renderLegend();
}
function renderLegend(){
  document.getElementById('map-legend').innerHTML=
    '<div class="map-legend-title">Nombre de revues</div>'+
    COLOR_SCALE.map(b=>`<div class="legend-row"><div class="legend-swatch" style="background:${b.color}"></div><span>${b.label}</span></div>`).join('');
}

// ── APC Chart ─────────────────────────────────────────────────────────
function buildApcData(minJ){
  return [...countryStats.entries()]
    .filter(([,s])=>s.apcEur.length>=minJ)
    .map(([country,s])=>({country,median:median(s.apcEur),count:s.apcEur.length}))
    .filter(d=>d.median!==null)
    .sort((a,b)=>b.median-a.median);
}
function renderApcChart(minJ=5){
  const dark=isDark();
  const data=buildApcData(minJ);
  const el=document.getElementById('apc-chart');
  if(!data.length){
    el.style.height='80px';
    if(apcChart){ apcChart.dispose(); apcChart=null; }
    el.innerHTML='<div style="padding:24px;color:var(--muted);text-align:center;font-size:13px;">Aucune donnée pour ce seuil.</div>';
    return;
  }
  const h=Math.max(420,data.length*26);
  el.style.height=h+'px'; el.innerHTML='';
  if(apcChart){ apcChart.dispose(); apcChart=null; }
  apcChart=echarts.init(el,dark?'dark':null);
  apcChart.setOption({
    backgroundColor:'transparent',
    tooltip:{
      trigger:'axis',axisPointer:{type:'shadow'},
      formatter(p){ const r=data[p[0].dataIndex]; return `<b>${r.country}</b><br/>Médiane : <b>${Math.round(r.median).toLocaleString('fr')} €</b><br/>Revues avec APC : ${r.count}`; },
    },
    grid:{left:160,right:90,top:10,bottom:30,containLabel:false},
    xAxis:{
      type:'value',name:'APC médian (€)',nameLocation:'end',
      nameTextStyle:{color:dark?'#8892a4':'#64748b',fontSize:11},
      axisLabel:{color:dark?'#8892a4':'#64748b',formatter:v=>v.toLocaleString('fr')+' €'},
      splitLine:{lineStyle:{color:dark?'rgba(255,255,255,.06)':'rgba(15,23,42,.07)'}},
    },
    yAxis:{
      type:'category',data:data.map(d=>d.country),inverse:true,
      axisLabel:{color:dark?'#f5f7fb':'#0f172a',fontSize:12,fontWeight:600,width:150,overflow:'truncate'},
      axisTick:{show:false},
      axisLine:{lineStyle:{color:dark?'rgba(255,255,255,.08)':'rgba(15,23,42,.10)'}},
    },
    series:[{
      type:'bar',data:data.map(d=>d.median),
      itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,0,[{offset:0,color:'#2563eb'},{offset:1,color:'#60a5fa'}]),borderRadius:[0,6,6,0]},
      label:{show:true,position:'right',formatter:p=>Math.round(p.value).toLocaleString('fr')+' €',color:dark?'#8892a4':'#64748b',fontSize:11},
    }],
  });
}
document.getElementById('apc-min-journals').addEventListener('change',e=>renderApcChart(Number(e.target.value)));
window.addEventListener('resize',()=>{ if(apcChart) apcChart.resize(); });

// ── Theme toggle ───────────────────────────────────────────────────────
document.getElementById('toggle-theme').addEventListener('click',()=>{
  const dark=document.documentElement.classList.toggle('dark');
  document.getElementById('toggle-theme').querySelector('.material-symbols-outlined').textContent=dark?'light_mode':'dark_mode';
  // Redraw map
  if(geoLayer) geoLayer.setStyle(mapStyle);
  // Swap tiles
  if(tileLayerRef&&leafletMap){
    leafletMap.removeLayer(tileLayerRef);
    tileLayerRef=L.tileLayer(dark?window._mapTiles.dark:window._mapTiles.light,{subdomains:'abcd',maxZoom:8}).addTo(leafletMap);
    geoLayer.bringToFront();
  }
  // Redraw chart
  const minJ=Number(document.getElementById('apc-min-journals').value);
  renderApcChart(minJ);
});

// ── Boot ──────────────────────────────────────────────────────────────
async function onDataReady(){
  const total=[...countryStats.values()].reduce((s,v)=>s+v.count,0);
  document.getElementById('total-count').textContent=total.toLocaleString('fr');
  setStatus('Chargement de la carte…');
  await initMap();
  renderApcChart(5);
  document.getElementById('loading-overlay').classList.add('hidden');
}

async function boot(){
  setStatus('Chargement des taux de change…');
  await fetchExchangeRates();
  setStatus('Connexion à DOAJ…');
  try{
    await fetchCSV();
    onDataReady();
  }catch(e){
    console.warn('CSV fetch failed:',e);
    document.getElementById('loading-overlay').classList.add('hidden');
    setupFallback();
  }
}
boot();
</script>
</body>
</html>
```

- [ ] **Step 2: Ouvrir dans le navigateur — vérifications**

- Loading overlay animé, puis disparaît après chargement
- Carte du monde avec choroplèthe (pays colorés selon nb revues)
- Hover → tooltip flottant (pays, nb revues, APC médian)
- Clic pays → drawer coulisse avec liste des revues triée alphabétiquement
- Graphique APC médian sous la carte, dropdown filtre fonctionnel
- Toggle thème → carte + graphique se redessinent correctement
- Lien « Afrique » ramène vers index.html

- [ ] **Step 3: Commit**

```bash
git add "index-new.html"
git commit -m "feat: index-new.html — world map OA dashboard with APC chart"
```

---

## Self-Review

| Exigence spec | Couverte |
|---|---|
| Carte choroplèthe mondiale | ✅ Task 1 (initMap) |
| Hover tooltip drapeau + stats | ✅ Task 1 (showTooltip) |
| Clic → drawer liste revues | ✅ Task 1 (openDrawer) |
| APC médian par pays en € | ✅ Task 1 (renderApcChart) |
| Filtre seuil minimum revues | ✅ select #apc-min-journals |
| corsproxy + fallback upload | ✅ fetchCSV + setupFallback |
| Conversion EUR open.er-api | ✅ fetchExchangeRates + toEur |
| Table mapping pays GeoJSON↔DOAJ | ✅ COUNTRY_NAME_MAP |
| Thème sombre/clair | ✅ toggle-theme + isDark() |
| Dark grid overlay | ✅ CSS ::before |
| Mobile responsive (drawer bas) | ✅ media query |
| Header back link + footer crédits | ✅ HTML |

✅ Aucun TBD. Types cohérents. Code complet dans chaque step.
