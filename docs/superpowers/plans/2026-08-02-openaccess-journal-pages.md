# Pages de revue dédiées (`/openaccess/{ISSN}`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every journal in the catalogue a real, shareable URL (`/openaccess/{ISSN or eISSN}`) that opens a panel with a generic DOAJ profile (always shown) plus the existing OpenAlex articles/charts content (shown only when the journal resolves in OpenAlex).

**Architecture:** Client-side routing (History API) inside the existing single-file SPA (`index.html`) — no build step, no server rendering. The panel stays visually overlaid on the catalogue, now driven by `pushState`/`popstate`. A `.htaccess` rewrite rule (separate file, manually merged by the user on the live host) lets direct visits to `/openaccess/...` load `index.html` instead of 404ing.

**Tech Stack:** Vanilla JS (no framework, no bundler), Papa Parse, ECharts, a Cloudflare Worker (`worker/worker.js`) that caches a filtered DOAJ CSV export.

**No test runner exists in this project** (confirmed: no `package.json`, no test files anywhere in the repo). Every past spec in `docs/superpowers/specs/` was verified manually in a browser, not with automated tests. This plan follows the same convention: each task ends with a concrete manual verification step (browser DOM/console check) instead of a `pytest`/`jest` run.

---

## File Structure

- Modify: `index.html` — one file, several regions:
  - `COLS` mapping (~line 1684)
  - `renderCards`/`renderBatch` — card title becomes a link (~line 5512)
  - `addOAButton` + its call site (~lines 5708, 5948)
  - `#oa-works-modal` markup + new CSS (~line 5984 onward)
  - `openalex-works-modal` script IIFE — all new routing/rendering logic goes **inside** this existing IIFE (it already owns `closeModal`, `state`, `openWorksModal`, and is the natural home for the rest; code outside this IIFE, like `renderCards`, already calls into it only through `window._oa...` exports, which this plan keeps using for the same reason).
- Modify: `worker/worker.js` — `NEEDED_COLS` list (~line 50).
- Create: `OA/.htaccess` — new file, Apache rewrite snippet.

---

## Task 1: Worker — add the 5 new DOAJ columns

**Files:**
- Modify: `worker/worker.js:50-75`

- [ ] **Step 1: Add the columns to `NEEDED_COLS`**

Current code (`worker/worker.js:49-75`):
```js
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
  "Preservation Services",
  "Preservation Service: national library",
  "Persistent article identifiers",
];
```

Replace with:
```js
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
```

- [ ] **Step 2: Verify the column names match the real DOAJ export**

Run:
```bash
curl -sL "https://doaj.org/csv" | head -1
```
Expected: the header line contains, verbatim, `Publisher`, `License attributes`, `URL for license terms`, `Review process information URL`, and `APC information URL` (comma-separated, exact casing). This confirms `findColumn()` (`worker/worker.js:158-172`, exact-match tier) will pick them up with no fuzzy matching needed.

- [ ] **Step 3: Commit**

```bash
git add worker/worker.js
git commit -m "Add Publisher, license and info-URL columns to the DOAJ cache pipeline"
```

---

## Task 2: `index.html` — add the 5 new `COLS` keys

**Files:**
- Modify: `index.html:1684-1710`

- [ ] **Step 1: Extend the `COLS` object**

Current code (`index.html:1684-1710`):
```js
  const COLS = {
    title: "Journal title",
    issn: "ISSN",
    eissn: "EISSN",
    url: "Journal URL",
    langs: "Languages in which the journal accepts manuscripts",
    license: "Journal license",
    country: "Country of publisher",
    countryOtherOrg: "Country of other organisation",
    weeks: "Average number of weeks between article submission and publication",
    doi: "DOI",
    subjects: "Subjects",
    keywords: "Keywords",
    opensince: "When did the journal start to publish all content using an open license?",
    addedon: "Added on Date",
    reviewprocess: "Review process",
    mostRecent: "Most Recent Article Added",
    numArticles: "Number of Article Records",
    doajUrl: "URL in DOAJ",
    authorCopyright: "Author holds copyright without restrictions",
    apc: "APC",
    apcAmount: "APC amount",
    apcCurrency: "APC amount currency",
    preservation: "Preservation Services",
    preservationNL: "Preservation Service: national library",
    persistentIds: "Persistent article identifiers"
  };
```

Replace with:
```js
  const COLS = {
    title: "Journal title",
    issn: "ISSN",
    eissn: "EISSN",
    url: "Journal URL",
    langs: "Languages in which the journal accepts manuscripts",
    license: "Journal license",
    licenseAttributes: "License attributes",
    licenseTermsUrl: "URL for license terms",
    country: "Country of publisher",
    countryOtherOrg: "Country of other organisation",
    weeks: "Average number of weeks between article submission and publication",
    doi: "DOI",
    subjects: "Subjects",
    keywords: "Keywords",
    opensince: "When did the journal start to publish all content using an open license?",
    addedon: "Added on Date",
    reviewprocess: "Review process",
    reviewProcessUrl: "Review process information URL",
    mostRecent: "Most Recent Article Added",
    numArticles: "Number of Article Records",
    doajUrl: "URL in DOAJ",
    authorCopyright: "Author holds copyright without restrictions",
    apc: "APC",
    apcInfoUrl: "APC information URL",
    apcAmount: "APC amount",
    apcCurrency: "APC amount currency",
    preservation: "Preservation Services",
    preservationNL: "Preservation Service: national library",
    persistentIds: "Persistent article identifiers",
    publisher: "Publisher"
  };
```

- [ ] **Step 2: Verify**

Open `index.html` in a browser (see Task 12 for how) and in the devtools console run:
```js
Object.keys(COLS).length
```
Expected: `29` (24 original + 5 new).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add COLS keys for the 5 new DOAJ fields"
```

---

## Task 3: `index.html` — new CSS for the journal-page additions

**Files:**
- Modify: `index.html` — insert a new `<style>` block right before `<div id="oa-works-modal">` (currently `index.html:6084`).

- [ ] **Step 1: Insert the new style block**

Immediately before this existing line (`index.html:6084`):
```html
<div id="oa-works-modal">
```

Insert:
```html
<style id="openaccess-journal-page-css">
  .card-title-link{ color:inherit; text-decoration:none; cursor:pointer; }
  .card-title-link:hover{ color:var(--accent); text-decoration:underline; }

  .oa-info-flag{ display:inline-flex; align-items:center; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; }
  .oa-info-flag-yes{ color:#15803d; background:rgba(34,197,94,.14); }
  .oa-info-flag-no{ color:var(--muted); background:var(--chip-bg); }

  .oa-journal-info{
    margin:0 20px 16px; padding:14px 16px; border:1px solid var(--card-border); border-radius:14px;
    background:var(--card); max-height:260px; overflow-y:auto;
  }
  .oa-info-row{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid var(--card-border); font-size:13px; }
  .oa-info-row:last-child{ border-bottom:none; }
  .oa-info-label{ flex:0 0 200px; font-weight:700; color:var(--muted); }
  .oa-info-value{ flex:1 1 240px; color:var(--text); }
  .oa-info-value a{ color:var(--accent); text-decoration:none; }
  .oa-info-value a:hover{ text-decoration:underline; }
  .oa-info-sublist{ margin:0; padding-left:18px; }

  .oa-openalex-absent-note{ margin:0 20px 20px; padding:14px 16px; color:var(--muted); font-size:13px; font-style:italic; }
</style>

```

- [ ] **Step 2: Verify**

```bash
grep -n "openaccess-journal-page-css" index.html
```
Expected: one match, the new `<style id="openaccess-journal-page-css">` line.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add CSS for journal-page info block, yes/no badges and card title links"
```

---

## Task 4: `index.html` — restructure `#oa-works-modal` markup

**Files:**
- Modify: `index.html:6084-6110`

- [ ] **Step 1: Add the generic-info container, wrap the OpenAlex content, add the absent-note**

Current code (`index.html:6084-6110`):
```html
<div id="oa-works-modal">
  <div class="oa-works-inner">
    <div class="oa-works-head">
      <div class="oa-works-head-title" id="oa-works-title"></div>
      <button class="oa-works-close" id="oa-works-close" title="Fermer" aria-label="Fermer">&#x2715;</button>
    </div>
    <div class="oa-charts-row">
      <div id="oa-availability-wrap" class="oa-availability-wrap">
        <div class="oa-availability-title">Disponibilité des textes</div>
        <div id="oa-availability-gauge"></div>
        <div id="oa-availability-count" class="oa-availability-count"></div>
      </div>
      <div id="oa-pubyear-chart-wrap" class="oa-pubyear-chart-wrap">
        <div class="oa-pubyear-chart-title">Publications par an</div>
        <div id="oa-pubyear-chart" style="height:150px;"></div>
      </div>
    </div>
    <div id="oa-topics-wrap" class="oa-topics-wrap">
      <button id="oa-topics-btn" type="button" class="oa-topics-btn">
        <span class="material-symbols-outlined">auto_awesome</span>
        Découvrir les sujets publiés par la revue
      </button>
      <div id="oa-topics-result" class="oa-topics-result" style="display:none;"></div>
    </div>
    <div class="oa-works-body" id="oa-works-body"></div>
  </div>
</div>
```

Replace with:
```html
<div id="oa-works-modal">
  <div class="oa-works-inner">
    <div class="oa-works-head">
      <div class="oa-works-head-title" id="oa-works-title"></div>
      <button class="oa-works-close" id="oa-works-close" title="Fermer" aria-label="Fermer">&#x2715;</button>
    </div>
    <div id="oa-journal-info" class="oa-journal-info"></div>
    <div id="oa-openalex-section" style="display:none;">
      <div class="oa-charts-row">
        <div id="oa-availability-wrap" class="oa-availability-wrap">
          <div class="oa-availability-title">Disponibilité des textes</div>
          <div id="oa-availability-gauge"></div>
          <div id="oa-availability-count" class="oa-availability-count"></div>
        </div>
        <div id="oa-pubyear-chart-wrap" class="oa-pubyear-chart-wrap">
          <div class="oa-pubyear-chart-title">Publications par an</div>
          <div id="oa-pubyear-chart" style="height:150px;"></div>
        </div>
      </div>
      <div id="oa-topics-wrap" class="oa-topics-wrap">
        <button id="oa-topics-btn" type="button" class="oa-topics-btn">
          <span class="material-symbols-outlined">auto_awesome</span>
          Découvrir les sujets publiés par la revue
        </button>
        <div id="oa-topics-result" class="oa-topics-result" style="display:none;"></div>
      </div>
      <div class="oa-works-body" id="oa-works-body"></div>
    </div>
    <div id="oa-openalex-absent-note" class="oa-openalex-absent-note" style="display:none;">
      Cette revue n'est pas (encore) indexée par OpenAlex.
    </div>
  </div>
</div>
```

(Only structural change: a new `#oa-journal-info` div, a new `#oa-openalex-section` wrapper around the pre-existing charts/topics/body block, and a new `#oa-openalex-absent-note` div. No existing IDs, classes or nested content were altered.)

- [ ] **Step 2: Verify**

```bash
grep -n "oa-journal-info\|oa-openalex-section\|oa-openalex-absent-note" index.html
```
Expected: 3 matches (one per new id), all inside `.oa-works-inner`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Wrap OpenAlex panel content in a toggleable section, add generic-info slot"
```

---

## Task 5: `index.html` — card title becomes the universal link

**Files:**
- Modify: `index.html:5512-5516`

- [ ] **Step 1: Replace the title element construction**

Current code (`index.html:5512-5516`):
```js
      const titleEl = document.createElement('div');
      titleEl.className = 'card-title';
      titleEl.style.cssText = 'padding-right:' + (isDiamond ? '44px' : '22px') + ';line-height:1.3;';
      titleEl.textContent = title;
      cardHeader.appendChild(titleEl);
```

Replace with:
```js
      const primaryId = normIssnStr(eissn) || normIssnStr(issn) || null;
      let titleEl;
      if (primaryId) {
        titleEl = document.createElement('a');
        titleEl.href = '/openaccess/' + encodeURIComponent(primaryId);
        titleEl.className = 'card-title card-title-link';
        titleEl.addEventListener('click', function(e){
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          if (typeof window._openJournalRoute === 'function') window._openJournalRoute(r, true);
        });
      } else {
        titleEl = document.createElement('div');
        titleEl.className = 'card-title';
      }
      titleEl.style.cssText = 'padding-right:' + (isDiamond ? '44px' : '22px') + ';line-height:1.3;';
      titleEl.textContent = title;
      cardHeader.appendChild(titleEl);
```

`normIssnStr` is already defined at `index.html:5380` (used elsewhere in this same function), and `eissn`/`issn` are already in scope two lines above the block being replaced (`index.html:5440-5441`) — no new variables need to be threaded in.

- [ ] **Step 2: Verify (deferred functional check)**

`window._openJournalRoute` doesn't exist yet (added in Task 9) — this is expected at this point; the `typeof === 'function'` guard means clicking a title right now silently does nothing instead of throwing. Confirm no console error by grepping for the change:
```bash
grep -n "card-title-link" index.html
```
Expected: 2 matches (this task's use, plus the CSS rule from Task 3).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Make card titles link to their /openaccess page"
```

---

## Task 6: `index.html` — OpenAlex badge uses the same route

**Files:**
- Modify: `index.html:5708` (call site)
- Modify: `index.html:5948-5980` (`addOAButton`)

- [ ] **Step 1: Pass the row into `addOAButton`**

Current code (`index.html:5698-5713`):
```js
      const _oaEi = (eissn||'').trim(), _oaPi = (issn||'').trim();
      if((_oaEi || _oaPi) && typeof window._oaFetch === 'function'){
        card.dataset.oaDone = '1';
        card.dataset.inOpenalex = 'pending';
        window._oaFetch(_oaEi, _oaPi).then(oaData => {
          if(!card.isConnected) return;
          if(!oaData || !oaData.works_count){
            card.dataset.inOpenalex = 'no';
          } else {
            card.dataset.inOpenalex = 'yes';
            if(typeof window._oaAddButton === 'function') window._oaAddButton(card, oaData);
          }
        });
      } else {
        card.dataset.inOpenalex = 'no';
      }
```

Replace the inner call with:
```js
      const _oaEi = (eissn||'').trim(), _oaPi = (issn||'').trim();
      if((_oaEi || _oaPi) && typeof window._oaFetch === 'function'){
        card.dataset.oaDone = '1';
        card.dataset.inOpenalex = 'pending';
        window._oaFetch(_oaEi, _oaPi).then(oaData => {
          if(!card.isConnected) return;
          if(!oaData || !oaData.works_count){
            card.dataset.inOpenalex = 'no';
          } else {
            card.dataset.inOpenalex = 'yes';
            if(typeof window._oaAddButton === 'function') window._oaAddButton(card, oaData, r);
          }
        });
      } else {
        card.dataset.inOpenalex = 'no';
      }
```

- [ ] **Step 2: Update `addOAButton` to route instead of opening the OpenAlex modal directly**

Current code (`index.html:5948-5980`):
```js
  function addOAButton(card, oaData) {
    if (card.querySelector('.openalex-btn')) return;
    var foot = card.querySelector('.card-footer');
    if (!foot) return;
    var left = foot.querySelector('div');
    if (!left) return;

    var titleEl = card.querySelector('.card-title');
    var journalTitle = titleEl ? titleEl.textContent : '';

    var a = document.createElement('button');
    a.type = 'button';
    a.className = 'openalex-btn';
    attachTip(a, 'OpenAlex', [oaData.works_count.toLocaleString('fr-FR') + ' articles indexés', 'Cliquez pour explorer les articles']);

    var cnt = document.createElement('span');
    cnt.className = 'openalex-count';
    cnt.textContent = fmtCount(oaData.works_count);

    var img = document.createElement('img');
    img.className = 'openalex-logo';
    img.src = OA_LOGO;
    img.alt = 'OpenAlex';

    a.appendChild(cnt);
    a.appendChild(img);
    a.addEventListener('click', function(){
      if (typeof window._oaOpenWorksModal === 'function') window._oaOpenWorksModal(oaData, journalTitle);
    });
    left.appendChild(a);
  }
  window._oaAddButton = addOAButton;
```

Replace with:
```js
  function addOAButton(card, oaData, row) {
    if (card.querySelector('.openalex-btn')) return;
    var foot = card.querySelector('.card-footer');
    if (!foot) return;
    var left = foot.querySelector('div');
    if (!left) return;

    var a = document.createElement('button');
    a.type = 'button';
    a.className = 'openalex-btn';
    attachTip(a, 'OpenAlex', [oaData.works_count.toLocaleString('fr-FR') + ' articles indexés', 'Cliquez pour explorer les articles']);

    var cnt = document.createElement('span');
    cnt.className = 'openalex-count';
    cnt.textContent = fmtCount(oaData.works_count);

    var img = document.createElement('img');
    img.className = 'openalex-logo';
    img.src = OA_LOGO;
    img.alt = 'OpenAlex';

    a.appendChild(cnt);
    a.appendChild(img);
    a.addEventListener('click', function(){
      if (typeof window._openJournalRoute === 'function') window._openJournalRoute(row, true);
    });
    left.appendChild(a);
  }
  window._oaAddButton = addOAButton;
```

(`journalTitle`/`titleEl` lookup is removed — no longer needed, since `openJournalPage` (Task 8) reads the title straight from `row[COLS.title]`.)

- [ ] **Step 3: Verify**

```bash
grep -n "function addOAButton" index.html
grep -n "_oaAddButton(card, oaData, r)" index.html
```
Expected: both present, one each.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Route the OpenAlex badge click through the same journal-page opener"
```

---

## Task 7: `index.html` — resolution helpers + generic-info renderer

**Files:**
- Modify: `index.html` — insert inside the `openalex-works-modal` IIFE, right after the `loadSourceCard` function ends and before `function openWorksModal` begins.

- [ ] **Step 1: Insert the new functions**

Current code (`index.html:6516-6528`):
```js
  function loadSourceCard(sourceId, myToken){
    // Les fiches pré-résolues (cache d'enrichissement) ne contiennent que {id, works_count} :
    // on va toujours chercher la fiche complète de la source pour ces informations.
    fetch('https://api.openalex.org/sources/' + encodeURIComponent(sourceId))
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(full){
        if(!full || myToken !== state.token) return;
        renderPubYearChart(full.counts_by_year);
      })
      .catch(function(){});
  }

  function openWorksModal(oaData, journalTitle){
```

Insert the new block between `loadSourceCard`'s closing `}` and `function openWorksModal`:
```js
  function loadSourceCard(sourceId, myToken){
    // Les fiches pré-résolues (cache d'enrichissement) ne contiennent que {id, works_count} :
    // on va toujours chercher la fiche complète de la source pour ces informations.
    fetch('https://api.openalex.org/sources/' + encodeURIComponent(sourceId))
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(full){
        if(!full || myToken !== state.token) return;
        renderPubYearChart(full.counts_by_year);
      })
      .catch(function(){});
  }

  function findRowByIssn(id){
    var norm = normIssnStr(id);
    if(!norm || typeof RAW === 'undefined' || !Array.isArray(RAW)) return null;
    for(var i=0;i<RAW.length;i++){
      var row = RAW[i];
      if(normIssnStr(row[COLS.issn]) === norm || normIssnStr(row[COLS.eissn]) === norm) return row;
    }
    return null;
  }

  function primaryIdForRow(row){
    return normIssnStr(row[COLS.eissn]) || normIssnStr(row[COLS.issn]) || null;
  }

  function issnFromPath(pathname){
    var m = /^\/openaccess\/([^/]+)\/?$/.exec(pathname);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function yesNoBadge(isYes){
    var span = document.createElement('span');
    span.className = 'oa-info-flag ' + (isYes ? 'oa-info-flag-yes' : 'oa-info-flag-no');
    span.textContent = isYes ? 'Oui' : 'Non';
    return span;
  }

  function addInfoRow(container, label, valueNode){
    if(valueNode == null) return;
    if(typeof valueNode === 'string' && !valueNode.trim()) return;
    var row = document.createElement('div');
    row.className = 'oa-info-row';
    var lbl = document.createElement('span');
    lbl.className = 'oa-info-label';
    lbl.textContent = label;
    var val = document.createElement('span');
    val.className = 'oa-info-value';
    if(typeof valueNode === 'string') val.textContent = valueNode;
    else val.appendChild(valueNode);
    row.appendChild(lbl); row.appendChild(val);
    container.appendChild(row);
  }

  function externalLink(url, label){
    var a = document.createElement('a');
    a.href = esc(url); a.target = '_blank'; a.rel = 'noopener';
    a.textContent = label || 'En savoir plus';
    return a;
  }

  function estimateArticlesPerYear(row){
    var n = parseInt(row[COLS.numArticles], 10);
    if(!n || n <= 0) return null;
    var startYear = parseInt(row[COLS.opensince], 10);
    if(!startYear){
      var d = row[COLS.addedon] && typeof parseFlexibleDate === 'function' ? parseFlexibleDate(row[COLS.addedon]) : null;
      startYear = d ? d.getFullYear() : null;
    }
    if(!startYear) return null;
    var years = Math.max(1, new Date().getFullYear() - startYear);
    return Math.round(n / years);
  }

  function renderJournalInfo(row){
    var container = document.getElementById('oa-journal-info');
    container.innerHTML = '';

    var country = row[COLS.country];
    if(country){
      var cVal = document.createElement('span');
      cVal.innerHTML = (typeof countryFlagHtml === 'function' ? countryFlagHtml(country) : '') + esc(country);
      addInfoRow(container, 'Pays', cVal);
    }

    addInfoRow(container, 'Éditeur', row[COLS.publisher]);

    var langs = typeof splitMulti === 'function' ? splitMulti(row[COLS.langs]) : [];
    if(langs.length) addInfoRow(container, 'Langues', langs.join(', '));

    var licenseParts = [row[COLS.license], row[COLS.licenseAttributes]].filter(Boolean);
    if(licenseParts.length) addInfoRow(container, 'Licence', licenseParts.join(' — '));
    if(row[COLS.licenseTermsUrl]) addInfoRow(container, 'Texte de la licence', externalLink(row[COLS.licenseTermsUrl]));

    addInfoRow(container, 'Statut Diamant', yesNoBadge(typeof isApcNoRow === 'function' && isApcNoRow(row)));

    if(typeof makeKeywordChips === 'function'){
      var kwNode = makeKeywordChips(row);
      if(kwNode && kwNode.childNodes && kwNode.childNodes.length) addInfoRow(container, 'Mots-clés', kwNode);
    }

    var subjects = (row[COLS.subjects] || '').split('|').map(function(s){ return s.trim(); }).filter(Boolean);
    if(subjects.length){
      var ul = document.createElement('ul');
      ul.className = 'oa-info-sublist';
      subjects.forEach(function(s){ var li = document.createElement('li'); li.textContent = s; ul.appendChild(li); });
      addInfoRow(container, 'Sujets (classification DOAJ)', ul);
    }

    if(row[COLS.reviewprocess]){
      var revVal = document.createElement('span');
      revVal.appendChild(document.createTextNode(row[COLS.reviewprocess]));
      if(row[COLS.reviewProcessUrl]){
        revVal.appendChild(document.createTextNode(' — '));
        revVal.appendChild(externalLink(row[COLS.reviewProcessUrl]));
      }
      addInfoRow(container, "Processus d'évaluation", revVal);
    }

    if(row[COLS.weeks]) addInfoRow(container, 'Délai de publication', row[COLS.weeks] + ' semaines');

    var apcYes = String(row[COLS.apc] || '').trim().toLowerCase() === 'yes';
    var apcVal = document.createElement('span');
    if(apcYes){
      var parsed = typeof parseApcAmount === 'function' ? parseApcAmount(row) : null;
      var eur = parsed && typeof toEur === 'function' ? toEur(parsed.amount, parsed.currency) : null;
      var txt = 'Oui';
      if(parsed) txt += ' — ' + parsed.amount.toLocaleString('fr-FR') + ' ' + parsed.currency + (eur ? ' (≈ ' + eur.toLocaleString('fr-FR') + ' €)' : '');
      apcVal.appendChild(document.createTextNode(txt));
    } else {
      apcVal.appendChild(document.createTextNode('Non'));
    }
    if(row[COLS.apcInfoUrl]){
      apcVal.appendChild(document.createTextNode(' — '));
      apcVal.appendChild(externalLink(row[COLS.apcInfoUrl]));
    }
    addInfoRow(container, 'Frais de publication (APC)', apcVal);

    var preservationParts = [row[COLS.preservation], row[COLS.preservationNL]].filter(Boolean);
    if(preservationParts.length) addInfoRow(container, 'Services de préservation', preservationParts.join(' · '));

    addInfoRow(container, 'Identifiant pérenne', row[COLS.persistentIds] || 'Aucun');

    addInfoRow(container, 'Droit d\'auteur', yesNoBadge(String(row[COLS.authorCopyright] || '').trim().toLowerCase() === 'yes'));

    if(row[COLS.opensince]) addInfoRow(container, 'Ouvert en accès libre depuis', row[COLS.opensince]);

    var numArticles = row[COLS.numArticles];
    if(numArticles){
      var estimate = estimateArticlesPerYear(row);
      var txt2 = Number(numArticles).toLocaleString('fr-FR') + ' articles indexés au DOAJ';
      if(estimate) txt2 += ' (~' + estimate.toLocaleString('fr-FR') + ' articles/an, estimation)';
      addInfoRow(container, 'Articles indexés', txt2);
    }

    var linksWrap = document.createElement('span');
    if(row[COLS.url]) linksWrap.appendChild(externalLink(row[COLS.url], 'Site de la revue'));
    if(row[COLS.url] && row[COLS.doajUrl]) linksWrap.appendChild(document.createTextNode(' · '));
    if(row[COLS.doajUrl]) linksWrap.appendChild(externalLink(row[COLS.doajUrl], 'Fiche DOAJ'));
    if(linksWrap.childNodes.length) addInfoRow(container, 'Liens', linksWrap);
  }

  function openWorksModal(oaData, journalTitle){
```

- [ ] **Step 2: Verify**

```bash
grep -n "function renderJournalInfo\|function findRowByIssn\|function estimateArticlesPerYear" index.html
```
Expected: each appears exactly once, all before `function openWorksModal`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add ISSN resolution helpers and the generic DOAJ info renderer"
```

---

## Task 8: `index.html` — `openJournalPage` orchestration + not-found state

**Files:**
- Modify: `index.html` — insert right after `window._oaOpenWorksModal = openWorksModal;` (currently `index.html:6567`).

- [ ] **Step 1: Insert the orchestration functions**

Current code (`index.html:6564-6570`):
```js
    modal.style.display = 'flex';
    loadPage();
  }
  window._oaOpenWorksModal = openWorksModal;

  var topicsBtn = document.getElementById('oa-topics-btn');
  if(topicsBtn) topicsBtn.addEventListener('click', generateTopics);
```

Replace with:
```js
    modal.style.display = 'flex';
    loadPage();
  }
  window._oaOpenWorksModal = openWorksModal;

  var pageToken = 0;

  function openJournalPage(row){
    var myToken = ++pageToken;
    var modal = document.getElementById('oa-works-modal');
    var titleEl = document.getElementById('oa-works-title');
    var oaSection = document.getElementById('oa-openalex-section');
    var absentNote = document.getElementById('oa-openalex-absent-note');

    var title = row[COLS.title] || 'Revue sans titre';
    var doajUrl = row[COLS.doajUrl];
    titleEl.innerHTML = doajUrl
      ? '<a href="' + esc(doajUrl) + '" target="_blank" rel="noopener" class="oa-works-title-link">' + esc(title) + '</a>'
      : esc(title);

    renderJournalInfo(row);

    oaSection.style.display = 'none';
    absentNote.style.display = 'none';

    modal.style.display = 'flex';
    document.title = title + ' · ' + SITE_TITLE;

    var eissn = row[COLS.eissn], issn = row[COLS.issn];
    if((eissn || issn) && typeof window._oaFetch === 'function'){
      window._oaFetch(eissn, issn).then(function(oaData){
        if(myToken !== pageToken) return;
        if(oaData && oaData.works_count){
          oaSection.style.display = '';
          openWorksModal(oaData, title);
        } else {
          absentNote.style.display = 'block';
        }
      });
    } else {
      absentNote.style.display = 'block';
    }
  }
  window._openJournalPage = openJournalPage;

  function openJournalPageNotFound(id){
    var modal = document.getElementById('oa-works-modal');
    document.getElementById('oa-works-title').textContent = 'Revue introuvable';
    document.getElementById('oa-journal-info').innerHTML =
      '<div class="oa-works-state">Aucune revue ne correspond à l\'identifiant ' + esc(id) + ' dans le catalogue.</div>';
    document.getElementById('oa-openalex-section').style.display = 'none';
    document.getElementById('oa-openalex-absent-note').style.display = 'none';
    modal.style.display = 'flex';
  }

  var topicsBtn = document.getElementById('oa-topics-btn');
  if(topicsBtn) topicsBtn.addEventListener('click', generateTopics);
```

`SITE_TITLE` is defined in Task 9 (it must exist before `openJournalPage` runs, not before it's *defined* in the file — function bodies aren't evaluated until called, so declaration order between `openJournalPage` and `SITE_TITLE`/`ROUTE` doesn't matter as long as both exist in the same IIFE before any click happens).

- [ ] **Step 2: Verify**

```bash
grep -n "function openJournalPage\|function openJournalPageNotFound" index.html
```
Expected: one match each, both after `window._oaOpenWorksModal = openWorksModal;`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add openJournalPage orchestration (generic info + conditional OpenAlex section)"
```

---

## Task 9: `index.html` — routing layer (pushState/popstate, open/close)

**Files:**
- Modify: `index.html:6572-6580` (existing close handlers)
- Modify: `index.html` — insert routing code right before the IIFE's closing `})();` (currently `index.html:6582`).

- [ ] **Step 1: Rewire the existing close handlers**

Current code (`index.html:6572-6581`):
```js
  document.addEventListener('click', function(e){
    if(!e.target) return;
    if(e.target.id === 'oa-works-close' || e.target.id === 'oa-works-modal') closeModal();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      var modal = document.getElementById('oa-works-modal');
      if(modal && modal.style.display !== 'none') closeModal();
    }
  });
```

Replace with:
```js
  document.addEventListener('click', function(e){
    if(!e.target) return;
    if(e.target.id === 'oa-works-close' || e.target.id === 'oa-works-modal') closeJournalRoute();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      var modal = document.getElementById('oa-works-modal');
      if(modal && modal.style.display !== 'none') closeJournalRoute();
    }
  });
```

- [ ] **Step 2: Insert the routing functions before the IIFE closes**

Current code (`index.html:6581-6583`):
```js
  });
})();
</script>
```

Replace with:
```js
  });

  var SITE_TITLE = document.title;
  var ROUTE = { active: false, pushed: false };

  function openJournalRoute(row, pushUrl){
    var id = primaryIdForRow(row);
    if(!id) return;
    if(pushUrl){
      history.pushState({ openaccess: id }, '', '/openaccess/' + encodeURIComponent(id));
      ROUTE.pushed = true;
    }
    ROUTE.active = true;
    openJournalPage(row);
  }
  window._openJournalRoute = openJournalRoute;

  function finishClose(){
    ROUTE.active = false;
    ROUTE.pushed = false;
    closeModal();
    document.title = SITE_TITLE;
  }

  function closeJournalRoute(){
    if(!ROUTE.active) return;
    if(ROUTE.pushed) history.back();
    else { history.replaceState(null, '', '/'); finishClose(); }
  }

  window.addEventListener('popstate', function(){
    var id = issnFromPath(location.pathname);
    if(id){
      ROUTE.active = true;
      ROUTE.pushed = true;
      var row = findRowByIssn(id);
      if(row) openJournalPage(row); else openJournalPageNotFound(id);
    } else if(ROUTE.active){
      finishClose();
    }
  });
})();
</script>
```

(`ROUTE.pushed = true` in the `popstate` handler covers navigating forward/back between two different `/openaccess/...` entries: whichever one you land on, a further "back" should still have somewhere to go.)

- [ ] **Step 3: Verify**

```bash
grep -n "function openJournalRoute\|function closeJournalRoute\|function finishClose\|addEventListener('popstate'" index.html
```
Expected: one match each.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add pushState/popstate routing for journal pages"
```

---

## Task 10: `index.html` — handle direct/initial visits to `/openaccess/...`

**Files:**
- Modify: `index.html` — insert right before the IIFE's closing `})();` (now after Task 9's insertion).

- [ ] **Step 1: Insert initial-route handling**

Current code (end of IIFE, after Task 9):
```js
    } else if(ROUTE.active){
      finishClose();
    }
  });
})();
</script>
```

Replace with:
```js
    } else if(ROUTE.active){
      finishClose();
    }
  });

  function waitForRawThenRoute(id){
    if(typeof RAW !== 'undefined' && Array.isArray(RAW) && RAW.length){
      var row = findRowByIssn(id);
      if(row) openJournalPage(row); else openJournalPageNotFound(id);
      return;
    }
    setTimeout(function(){ waitForRawThenRoute(id); }, 350);
  }

  function handleInitialRoute(){
    var id = issnFromPath(location.pathname);
    if(!id) return;
    ROUTE.active = true;
    ROUTE.pushed = false;

    document.getElementById('oa-works-modal').style.display = 'flex';
    document.getElementById('oa-works-title').textContent = 'Chargement…';
    document.getElementById('oa-journal-info').innerHTML = '<div class="oa-works-state">Chargement de la fiche…</div>';
    document.getElementById('oa-openalex-section').style.display = 'none';
    document.getElementById('oa-openalex-absent-note').style.display = 'none';

    waitForRawThenRoute(id);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', handleInitialRoute);
  } else {
    handleInitialRoute();
  }
})();
</script>
```

- [ ] **Step 2: Verify**

```bash
grep -n "function handleInitialRoute\|function waitForRawThenRoute" index.html
```
Expected: one match each, and both calls to `document.getElementById('oa-works-modal')` etc. reference IDs that already exist from Task 4.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Handle direct/refreshed visits to /openaccess/{id}"
```

---

## Task 11: Create the `.htaccess` rewrite snippet

**Files:**
- Create: `OA/.htaccess`

- [ ] **Step 1: Create the file**

```apache
# --- Pages de revue OpenAccess (routage SPA côté client) ---
# À FUSIONNER dans le .htaccess existant du serveur (ne pas remplacer :
# ce dépôt local n'a pas de copie du .htaccess actuellement en ligne).
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^openaccess/ index.html [L]
```

- [ ] **Step 2: Verify**

```bash
cat "OA/.htaccess"
```
Expected: the 6 lines above, verbatim.

- [ ] **Step 3: Commit**

```bash
git add OA/.htaccess
git commit -m "Add .htaccess snippet for /openaccess SPA rewrite (to merge on the live host)"
```

---

## Task 12: Manual verification (local, pre-deploy)

This exercises everything that doesn't require the live server or the worker redeploy: card links, routing, generic info rendering, and graceful handling of the 5 fields that are still empty until the worker is redeployed (Task 1 only changed the *code* — the live `/csv` cache still won't have `Publisher` etc. until `wrangler deploy` + a cache refresh happen, which is Task 13, done by the user).

- [ ] **Step 1: Open the file and let the catalogue load**

Open `file:///C:/Users/ynnon/OneDrive/Documents/Claude/Projects/DOAJ/OA/index.html` in the Browser pane. Wait for journal cards to render (the catalogue section).

- [ ] **Step 2: Click a journal title, verify the panel opens with a real URL**

Click any journal card's title. Expected:
- The panel (`#oa-works-modal`) opens.
- The browser address bar shows `file:///C:/.../openaccess/{ISSN}` (the `pushState` path is appended to whatever the current origin is — on `file://` this still updates the visible path even though it can't be reloaded from a fresh tab).
- `#oa-journal-info` shows at least: Pays, Langues, Licence, Statut Diamant badge, Mots-clés (if any), Sujets (if any), Processus d'évaluation, Délai de publication, Frais de publication, Services de préservation (if any), Identifiant pérenne, Droit d'auteur badge, Ouvert en accès libre depuis, Articles indexés, Liens.
- `Éditeur`, the license-terms link, and the two "En savoir plus" links (évaluation/APC) are silently absent (worker not redeployed yet) — this is expected, not a bug.

- [ ] **Step 3: Verify the OpenAlex section shows only when relevant**

Pick a journal you already know is OpenAlex-indexed (one that shows the OpenAlex badge with an article count on its card). Click its title. Expected: `#oa-openalex-section` becomes visible (charts, "Découvrir les sujets" button, article list load). Then close it (Escape) and click the title of a journal that has **no** OpenAlex badge on its card. Expected: `#oa-openalex-absent-note` shows "Cette revue n'est pas (encore) indexée par OpenAlex.", and `#oa-openalex-section` stays hidden.

- [ ] **Step 4: Verify back-navigation closes the panel**

With a panel open (opened via a card click, so `ROUTE.pushed` is `true`), press the browser's Back button (or call `history.back()` in the console). Expected: the panel closes, `document.title` reverts to the original site title, and the address bar path goes back to what it was before the click.

- [ ] **Step 5: Verify switching between two journals doesn't show stale data**

Open journal A (OpenAlex-indexed), then — while its OpenAlex section may still be loading — immediately click journal B's title without closing A first. Expected: the panel ends up showing journal B's info only (no flash of A's articles/charts). This exercises the `pageToken` guard in `openJournalPage`.

- [ ] **Step 6: Verify the OpenAlex badge opens the same page as the title**

Click a card's OpenAlex badge (not the title). Expected: identical panel/URL/content as clicking that same card's title.

- [ ] **Step 7: Check the console for errors**

Open devtools console. Expected: no new errors introduced by this feature (pre-existing unrelated warnings, if any, are out of scope).

No commit for this task — it's verification only, not a code change.

---

## Task 13: Post-deploy checklist (done by the user, after uploading)

This task can't be executed or verified from this session — it requires the user's Cloudflare account and hosting access. Listed here so nothing gets forgotten.

- [ ] **Step 1: Deploy the worker**

```bash
cd worker
wrangler deploy
```

- [ ] **Step 2: Refresh the DOAJ cache**

Either wait for the monthly cron, or call the manual refresh endpoint with the `REFRESH_SECRET` configured on the Cloudflare account:
```bash
curl "https://doaj-african-cache.ynnonazaline.workers.dev/refresh?secret=YOUR_SECRET"
```

- [ ] **Step 3: Confirm the new fields are live**

```bash
curl -s "https://doaj-african-cache.ynnonazaline.workers.dev/csv" | head -c 2000
```
Expected: the JSON objects now include `"Publisher"`, `"License attributes"`, `"URL for license terms"`, `"Review process information URL"`, `"APC information URL"` keys.

- [ ] **Step 4: Merge the `.htaccess` snippet**

Open the live server's existing `.htaccess` (via FTP/cPanel File Manager — not accessible from this session) and add the block from `OA/.htaccess` (Task 11) into it, without removing any existing rules.

- [ ] **Step 5: Upload `index.html`**

Upload the updated `index.html` to the host, same way as previous updates.

- [ ] **Step 6: Verify live**

```bash
curl -sI "https://africanjournals.azilan.me/openaccess/1234-5678"
```
Expected: `200 OK` with `Content-Type: text/html` (any valid-looking ISSN works for this check — the rewrite is unconditional; the "not found" state, if that ISSN isn't real, renders client-side after the page loads). Then open `https://africanjournals.azilan.me/openaccess/{a real ISSN from the catalogue}` in a browser and confirm the panel opens directly, without first clicking through the catalogue.

---

## Self-Review Notes

- **Spec coverage:** every numbered section of the design doc (§1 link generation, §2 ISSN resolution, §3 generic info block incl. the follow-up badge/URL additions, §4 conditional OpenAlex section, §5 routing, §6 worker columns, §7 `.htaccess`) maps to a task above (Tasks 5–6, 7, 7, 8, 9–10, 1–2, 11 respectively).
- **Placeholder scan:** no TBD/TODO; every step shows complete code, not a description of code.
- **Type/name consistency check:** `primaryIdForRow`, `findRowByIssn`, `issnFromPath`, `openJournalPage`, `openJournalPageNotFound`, `openJournalRoute`, `closeJournalRoute`, `finishClose`, `ROUTE`, `SITE_TITLE`, `pageToken` are named identically everywhere they're used across Tasks 5–10 (cross-checked against the design spec's pseudocode, which used the same names).
