# Popup V5: Size, ECharts-Faithful Gauge, Domain/Subfield AI Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump the footer version to V5, enlarge the works popup, rebuild the PDF/HTML availability gauge to faithfully match the official ECharts *Progress Gauge* example placed side-by-side with the "Publications par an" chart, and ground the AI summary's opening sentence in real OpenAlex domain/subfield data instead of free-form generation.

**Architecture:** All frontend work is in `index.html`, inside the existing `#openalex-works-modal` script and its adjacent `<style id="openalex-works-css">` block, plus one single-line footer edit elsewhere in the file. The AI prompt logic is server-side in `worker/worker.js`, endpoint `POST /topics`.

**Tech Stack:** Vanilla JS (ES5-style), Apache ECharts 5.4.3 (already loaded), Cloudflare Workers + Workers AI (`@cf/meta/llama-3.1-8b-instruct-fp8`).

**Spec:** `docs/superpowers/specs/2026-07-25-popup-v5-gauge-domain-subfield-design.md`

---

## Before you start

Preview server: use the browser preview tool with `{name: "doaj-oa"}` (the working `.claude/launch.json` entry for this project — NOT `"OA-site"`, which doesn't exist in this repo's launch config).

No automated test suite for this static site. "Tests" are manual browser verification: reload, open the relevant UI, inspect with `read_console_messages` / `read_network_requests` / `read_page` / screenshots.

`index.html` is large (~315KB) — always grep first to find current line numbers (they will have shifted from the estimates below, since this plan follows a prior round of edits), then read/edit with exact string matches, not line-number assumptions.

This plan continues directly from a prior round of work (V4: merged OpenAlex button, availability gauge, narrative AI summary, collapse toggle — all already live on `master`). Tasks here are numbered 7-9, continuing that sequence.

---

### Task 7: Footer version bump + popup size increase

**Files:**
- Modify: `index.html` (footer text ~line 1523; `.oa-works-inner` CSS ~line 5985-5989)

- [ ] **Step 1: Bump the footer version**

Find (grep for `Mise à jour automatique mensuelle` to confirm the current line):

```html
        <div><strong style="color:var(--text);">V4</strong> — 2026 · Mise à jour automatique mensuelle des données DOAJ.</div>
```

Replace with:

```html
        <div><strong style="color:var(--text);">V5</strong> — 2026 · Mise à jour automatique mensuelle des données DOAJ.</div>
```

Do NOT touch the nearby "Documentation technique — V4.1" line (a separate, unrelated version number) — grep for `V4.1` first to confirm you're not near it, and only change the exact "V4"/"V5" footer line above.

- [ ] **Step 2: Enlarge the popup**

Find (grep for `.oa-works-inner{` to confirm current line):

```css
  #oa-works-modal .oa-works-inner{
    background:var(--card-solid); border:1px solid var(--card-border); border-radius:18px;
    width:min(660px, 94vw); max-height:min(720px, 88vh); display:flex; flex-direction:column;
    box-shadow:0 24px 64px rgba(0,0,0,.28);
  }
```

Replace with:

```css
  #oa-works-modal .oa-works-inner{
    background:var(--card-solid); border:1px solid var(--card-border); border-radius:18px;
    width:min(860px, 96vw); max-height:min(820px, 90vh); display:flex; flex-direction:column;
    box-shadow:0 24px 64px rgba(0,0,0,.28);
  }
```

- [ ] **Step 3: Manually verify**

In the browser preview, open the works popup for any journal and confirm it's visibly larger than before (roughly 860px wide on a normal desktop viewport, not 660px), and still fits on screen without overflowing (the `min(..., 96vw)`/`min(..., 90vh)` clamps should keep it responsive on narrow/short viewports). Scroll to the footer and confirm it reads "V5 — 2026", and that "Documentation technique — V4.1" (a different, unrelated number) is unchanged.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Bump footer to V5 and enlarge the works popup"
```

---

### Task 8: Rebuild the availability gauge to match the ECharts example, side-by-side with the pubyear chart

**Files:**
- Modify: `index.html` (HTML ~line 6082-6098; CSS ~line 5997-6002; JS function `renderAvailabilityGauge` ~line 6445-6476)

- [ ] **Step 1: Replace the HTML block**

Find (grep for `oa-availability-wrap` to confirm current lines — this sits between the popup header and the AI topics section):

```html
    <div id="oa-availability-wrap" class="oa-availability-wrap">
      <div id="oa-availability-gauge"></div>
      <div class="oa-availability-text">
        <div id="oa-availability-pct" class="oa-availability-pct"></div>
        <div id="oa-availability-count" class="oa-availability-count"></div>
      </div>
    </div>
    <div id="oa-pubyear-chart-wrap" class="oa-pubyear-chart-wrap">
      <div class="oa-pubyear-chart-title">Publications par an</div>
      <div id="oa-pubyear-chart" style="height:150px;"></div>
    </div>
```

Replace with:

```html
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
```

Note: `#oa-availability-pct` (the separate "X% des articles disponibles..." text line) is intentionally removed — the redesigned gauge shows its percentage directly via its own `detail` label (see Step 3), so the external line would be redundant. `#oa-availability-count` (the "N sur M articles" caption) is kept.

- [ ] **Step 2: Replace the CSS**

Find (grep for `.oa-pubyear-chart-wrap{` and `.oa-availability-wrap{` — both currently sit together):

```css
  .oa-pubyear-chart-wrap{ display:none; margin:0 20px 16px; padding:12px 16px 4px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); flex-shrink:0; }
  .oa-pubyear-chart-title{ font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
  .oa-availability-wrap{ display:none; align-items:center; gap:14px; margin:0 20px 16px; padding:12px 16px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); flex-shrink:0; }
  #oa-availability-gauge{ width:96px; height:96px; flex-shrink:0; }
  .oa-availability-pct{ font-size:15px; font-weight:800; color:var(--text); }
  .oa-availability-count{ font-size:12.5px; color:var(--muted); margin-top:2px; }
```

Replace with:

```css
  .oa-charts-row{ display:flex; gap:12px; margin:0 20px 16px; flex-shrink:0; }
  @media (max-width: 480px){ .oa-charts-row{ flex-direction:column; } }
  .oa-pubyear-chart-wrap{ display:none; margin:0; padding:12px 16px 4px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); flex:1 1 0; min-width:0; }
  .oa-pubyear-chart-title{ font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
  .oa-availability-wrap{ display:none; flex-direction:column; align-items:center; margin:0; padding:12px 16px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); flex:1 1 0; min-width:0; }
  .oa-availability-title{ align-self:flex-start; font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
  #oa-availability-gauge{ width:100%; max-width:190px; height:150px; }
  .oa-availability-count{ font-size:12.5px; color:var(--muted); margin-top:2px; }
```

Note: `.oa-pubyear-chart-wrap`/`.oa-availability-wrap` no longer carry their own `margin:0 20px 16px` — that horizontal/bottom margin now lives on the parent `.oa-charts-row`, since both boxes sit inside it. `.oa-availability-wrap` changes from a horizontal flex row (gauge + text side by side) to a vertical flex column (title, then gauge, then count caption), matching the new "gauge box vs. pubyear box" side-by-side layout instead of the old "gauge vs. its own caption" side-by-side layout.

- [ ] **Step 3: Rewrite `renderAvailabilityGauge` to match the official ECharts Progress Gauge example**

Find (grep for `function renderAvailabilityGauge` to confirm current lines):

```js
  function renderAvailabilityGauge(withLink, total){
    var wrap = document.getElementById('oa-availability-wrap');
    var pctEl = document.getElementById('oa-availability-pct');
    var countEl = document.getElementById('oa-availability-count');
    if(!wrap) return;
    if(!total){ wrap.style.display = 'none'; return; }
    var pct = Math.max(0, Math.min(100, Math.round((withLink / total) * 100)));
    wrap.style.display = 'flex';
    pctEl.textContent = pct + '% des articles disponibles en PDF ou HTML';
    countEl.textContent = withLink.toLocaleString('fr-FR') + ' sur ' + total.toLocaleString('fr-FR') + ' articles';

    var chart = ecInit('oa-availability-gauge');
    if(!chart) return;
    var dark = isDark(), sepia = isSepia();
    var trackColor  = dark ? 'rgba(245,247,251,.14)' : sepia ? 'rgba(180,83,9,.16)' : 'rgba(100,116,139,.14)';
    var accentColor = dark ? '#93c5fd' : sepia ? '#b45309' : '#2563eb';
    var textColor   = dark ? 'rgba(245,247,251,.82)' : sepia ? '#2c1a0a' : '#1e293b';
    chart.setOption({
      series: [{
        type: 'gauge',
        startAngle: 90, endAngle: -270,
        min: 0, max: 100,
        radius: '92%',
        progress: { show:true, width:12, itemStyle:{ color: accentColor } },
        axisLine: { lineStyle: { width:12, color:[[1, trackColor]] } },
        pointer: { show:false }, axisTick: { show:false }, splitLine: { show:false },
        axisLabel: { show:false }, anchor: { show:false }, title: { show:false },
        detail: { valueAnimation:true, fontSize:20, fontWeight:800, color:textColor, offsetCenter:[0,0], formatter:'{value}%' },
        data: [{ value: pct }]
      }]
    });
  }
```

Replace with:

```js
  function renderAvailabilityGauge(withLink, total){
    var wrap = document.getElementById('oa-availability-wrap');
    var countEl = document.getElementById('oa-availability-count');
    if(!wrap) return;
    if(!total){ wrap.style.display = 'none'; return; }
    var pct = Math.max(0, Math.min(100, Math.round((withLink / total) * 100)));
    wrap.style.display = 'flex';
    countEl.textContent = withLink.toLocaleString('fr-FR') + ' sur ' + total.toLocaleString('fr-FR') + ' articles';

    var chart = ecInit('oa-availability-gauge');
    if(!chart) return;
    var dark = isDark(), sepia = isSepia();
    var trackColor  = dark ? 'rgba(245,247,251,.14)' : sepia ? 'rgba(180,83,9,.16)' : 'rgba(100,116,139,.14)';
    var mutedColor  = dark ? 'rgba(245,247,251,.42)' : sepia ? '#7c4a1e' : '#64748b';
    var accentColor = dark ? '#93c5fd' : sepia ? '#b45309' : '#2563eb';
    var textColor   = dark ? 'rgba(245,247,251,.82)' : sepia ? '#2c1a0a' : '#1e293b';
    chart.setOption({
      series: [{
        type: 'gauge',
        progress: { show:true, width:10, itemStyle:{ color: accentColor } },
        axisLine: { lineStyle:{ width:10, color:[[1, trackColor]] } },
        axisTick: { show:false },
        splitLine: { length:8, lineStyle:{ width:1.5, color: mutedColor } },
        axisLabel: { distance:12, color: mutedColor, fontSize:10 },
        anchor: { show:true, showAbove:true, size:12, itemStyle:{ borderWidth:4, color: accentColor } },
        title: { show:false },
        detail: { valueAnimation:true, fontSize:22, fontWeight:800, color:textColor, offsetCenter:[0,'70%'], formatter:'{value}%' },
        data: [{ value: pct }]
      }]
    });
  }
```

This mirrors the official example's series structure one-for-one (`progress`, `axisLine`, `axisTick`, `splitLine`, `axisLabel`, `anchor`, `title`, `detail` with `offsetCenter:[0,'70%']` and `valueAnimation`) — no `startAngle`/`endAngle`/`min`/`max`/`pointer` overrides, so ECharts' own defaults apply exactly as they do on the example page (a ~270° arc with a visible default pointer needle layered over the progress arc). Only additions beyond the example: theme colors (`itemStyle`/`color` on `progress`/`axisLine`/`anchor`/`detail`, since the example uses flat gray/white), proportionally smaller sizes (our gauge lives in a ~190×150px card, not a full editor canvas), and `detail.formatter:'{value}%'` (the example's demo value has no unit).

- [ ] **Step 4: Manually verify**

Open the works popup for a journal that has both availability data and pubyear data. Confirm: the availability gauge and "Publications par an" chart now sit side by side in two roughly equal columns, both fitting inside the enlarged popup from Task 7. Confirm the gauge visually resembles the reference example — a partial ring with tick marks and a numeric label along the arc, a center pivot anchor, a needle pointer, and a percentage value near the bottom of the gauge — not the old thin plain ring. Resize the browser to under 480px width (`resize_window`) and confirm the two boxes stack vertically instead of squeezing side by side. Test both light and dark mode. Check `read_console_messages` for errors.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Rebuild availability gauge to match the ECharts Progress Gauge example, side-by-side with pubyear chart"
```

---

### Task 9: AI summary grounded in OpenAlex domain/subfield data

**Files:**
- Modify: `index.html` (JS: new `DOMAIN_FR` const near `TOPICS_URL`; `generateTopics()` rewritten)
- Modify: `worker/worker.js` (`/topics` handler: accept `domain`/`subfields`, two-branch system prompt)

- [ ] **Step 1: Add the domain translation table**

Find (grep for `var TOPICS_URL` to confirm current lines):

```js
  var PER_PAGE = 25;
  var TOPICS_URL = 'https://doaj-african-cache.ynnonazaline.workers.dev/topics';
  var state = { sourceId: null, journalTitle: '', page: 1, loading: false, done: false, token: 0 };
```

Replace with:

```js
  var PER_PAGE = 25;
  var TOPICS_URL = 'https://doaj-african-cache.ynnonazaline.workers.dev/topics';
  var DOMAIN_FR = {
    'Health Sciences': 'santé',
    'Life Sciences': 'sciences de la vie',
    'Physical Sciences': 'sciences physiques',
    'Social Sciences': 'sciences humaines et sociales'
  };
  var state = { sourceId: null, journalTitle: '', page: 1, loading: false, done: false, token: 0 };
```

OpenAlex has exactly these 4 top-level domains — this static table is a safe, permanent mapping, not a fragile guess. If OpenAlex ever adds a 5th domain, `DOMAIN_FR[unknownName]` simply evaluates to `undefined`, and later code (Step 2) already treats that as "no usable domain" — no crash, no untranslated English leaking into the French UI.

- [ ] **Step 2: Extract domain/subfield and send them to the Worker in `generateTopics()`**

Find (grep for `function generateTopics` to confirm current lines):

```js
  function generateTopics(){
    var btn = document.getElementById('oa-topics-btn');
    if(!btn || btn.disabled) return;
    var myToken = state.token;
    var sourceId = state.sourceId;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="animation:bar-pulse 1s infinite alternate;">hourglass_empty</span>Analyse en cours…';

    var url = 'https://api.openalex.org/works?filter=primary_location.source.id:' + encodeURIComponent(sourceId)
      + '&sort=publication_date:desc&per-page=100&select=abstract_inverted_index';

    fetch(url).then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function(data){
        if(myToken !== state.token) return;
        var results = (data && data.results) || [];
        var abstracts = results
          .map(function(w){ return invertedIndexToText(w.abstract_inverted_index); })
          .filter(Boolean);

        if(!abstracts.length){
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Réessayer';
          showTopicsResult('Résumés insuffisants pour générer une synthèse.', true);
          return;
        }

        return fetch(TOPICS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abstracts: abstracts, title: state.journalTitle })
        }).then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
          .then(function(json){
            if(!json || !json.topics) return Promise.reject(new Error('empty'));
            setTopicsCache(sourceId, json.topics);
            if(myToken !== state.token) return;
            showTopicsResult(json.topics, false);
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Régénérer';
          });
      })
      .catch(function(){
        if(myToken !== state.token) return;
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Réessayer';
        showTopicsResult('Impossible de générer les sujets pour le moment.', true);
      });
  }
```

Replace with:

```js
  function generateTopics(){
    var btn = document.getElementById('oa-topics-btn');
    if(!btn || btn.disabled) return;
    var myToken = state.token;
    var sourceId = state.sourceId;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined" style="animation:bar-pulse 1s infinite alternate;">hourglass_empty</span>Analyse en cours…';

    var url = 'https://api.openalex.org/works?filter=primary_location.source.id:' + encodeURIComponent(sourceId)
      + '&sort=publication_date:desc&per-page=100&select=abstract_inverted_index,primary_topic';

    fetch(url).then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
      .then(function(data){
        if(myToken !== state.token) return;
        var results = (data && data.results) || [];
        var abstracts = results
          .map(function(w){ return invertedIndexToText(w.abstract_inverted_index); })
          .filter(Boolean);

        if(!abstracts.length){
          btn.disabled = false;
          btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Réessayer';
          showTopicsResult('Résumés insuffisants pour générer une synthèse.', true);
          return;
        }

        var domainCounts = {};
        var subfieldCounts = {};
        results.forEach(function(w){
          var t = w.primary_topic;
          if(!t) return;
          var d = t.domain && t.domain.display_name;
          var s = t.subfield && t.subfield.display_name;
          if(d) domainCounts[d] = (domainCounts[d] || 0) + 1;
          if(s) subfieldCounts[s] = (subfieldCounts[s] || 0) + 1;
        });
        var topDomainRaw = Object.keys(domainCounts).sort(function(a,b){ return domainCounts[b] - domainCounts[a]; })[0] || null;
        var domainFr = topDomainRaw ? (DOMAIN_FR[topDomainRaw] || null) : null;
        var topSubfields = Object.keys(subfieldCounts).sort(function(a,b){ return subfieldCounts[b] - subfieldCounts[a]; }).slice(0, 3);

        return fetch(TOPICS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abstracts: abstracts, title: state.journalTitle, domain: domainFr, subfields: topSubfields })
        }).then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
          .then(function(json){
            if(!json || !json.topics) return Promise.reject(new Error('empty'));
            setTopicsCache(sourceId, json.topics);
            if(myToken !== state.token) return;
            showTopicsResult(json.topics, false);
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Régénérer';
          });
      })
      .catch(function(){
        if(myToken !== state.token) return;
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Réessayer';
        showTopicsResult('Impossible de générer les sujets pour le moment.', true);
      });
  }
```

Three changes only: (1) `select=abstract_inverted_index` → `select=abstract_inverted_index,primary_topic` in the `url`, (2) the new `domainCounts`/`subfieldCounts`/`topDomainRaw`/`domainFr`/`topSubfields` block computed from `results` (the same array already used for `abstracts`, no extra fetch), (3) `domain: domainFr, subfields: topSubfields` added to the POST body. Everything else (error handling, caching, button states) is untouched.

- [ ] **Step 3: Update the Worker to accept `domain`/`subfields` and branch its prompt**

Find (grep for `const title = typeof body.title` in `worker/worker.js` to confirm current lines):

```js
      const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "cette revue";

      // Server-side caps, independent of what the frontend sends.
      const capped = abstracts.slice(0, 100);
      let combined = capped.join("\n\n---\n\n");
      if (combined.length > 8000) combined = combined.slice(0, 8000);

      try {
        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
          messages: [
            {
              role: "system",
              content: "Tu es un assistant qui rédige une courte présentation éditoriale d'une revue scientifique à partir de résumés d'articles qu'elle a publiés. Rédige un texte fluide de 3 à 5 phrases, en français, qui décrit les grandes thématiques de recherche abordées par la revue en les regroupant (n'énumère jamais les articles un par un, ne cite aucun titre d'article). Commence par une phrase qui nomme la revue telle qu'elle t'est donnée. N'utilise ni tiret, ni liste à puces, ni titre : uniquement du texte continu."
            },
            { role: "user", content: "Nom de la revue : " + title + "\n\nRésumés d'articles :\n" + combined }
          ],
          max_tokens: 450
        });
```

Replace with:

```js
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
```

Everything below this point (the `topics` extraction, error handling, success/failure responses) is unchanged. The fallback branch (no `domain`, no `subfields`) is byte-for-byte the same prompt already live in production from the prior round — only the "has domain/subfields" branch is new.

- [ ] **Step 4: Manually verify**

This Worker change cannot be exercised live without `wrangler deploy` (a manual step the user runs separately, same as the prior round) — but you CAN verify the frontend sends the right payload. In the browser preview, open a journal's works popup, click "Découvrir les sujets publiés par la revue" (or "Régénérer"), and inspect the network request to `/topics` (`read_network_requests`, find the POST, read its body). Confirm the request body now includes `domain` (either a French string like `"sciences humaines et sociales"` or `null`) and `subfields` (an array of 0-3 English strings). Try this on at least two different journals to see different domain/subfield values (or confirm graceful `null`/`[]` for a journal whose fetched works lack `primary_topic` data). Also run `node -c worker/worker.js` to confirm the Worker file is still syntactically valid.

- [ ] **Step 5: Commit**

```bash
git add index.html worker/worker.js
git commit -m "Ground AI summary opening sentence in OpenAlex domain/subfield data"
```

- [ ] **Step 6: Flag the required manual deploy**

Same as the prior round: this Worker change has no effect in production until `wrangler deploy` (from `worker/`) is run by the user — not something to automate here.

---

## Deployment reminder

Task 7 and Task 8 (frontend-only) go live as soon as `index.html` is deployed/served — no extra step beyond the existing push/Vercel flow. Task 9's Worker half additionally requires `wrangler deploy` from `worker/`, run by the user.
