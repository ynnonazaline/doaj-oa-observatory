# Popup Gauge, Merged OpenAlex Button, Narrative AI Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PDF/HTML availability gauge to the OpenAlex works popup, merge the two per-card OpenAlex buttons into one, rewrite the AI "topics" summary into flowing narrative prose with a renamed trigger button, and add a collapse toggle for the generated summary.

**Architecture:** All frontend work lives in `index.html`, inside the existing IIFE scripts `#openalex-enrichment` (card button, function `addOAButton`) and `#openalex-works-modal` (popup: gauge, AI summary). The AI prompt itself is server-side, in the Cloudflare Worker `worker/worker.js`, endpoint `POST /topics`. No build step — `index.html` is served as a static file.

**Tech Stack:** Vanilla JS (ES5-style, no framework), Apache ECharts 5.4.3 (already loaded via CDN, `echarts.min.js`), Cloudflare Workers + Workers AI (`@cf/meta/llama-3.1-8b-instruct-fp8`).

**Spec:** `docs/superpowers/specs/2026-07-24-popup-gauge-merge-btn-ai-narrative-design.md`

---

## Before you start

Preview server: this project has a `.claude/launch.json` config named `OA-site` (`npx serve -l 3777 .`). Use the browser preview tool with `{name: "OA-site"}` to open it — do not start servers with Bash.

There is no automated test suite for this static site. "Tests" in this plan are manual browser verification steps: reload the page, open the relevant UI, and inspect it with `read_page` / `read_console_messages` / screenshots.

The file `index.html` is ~315KB (over the Read tool's single-read limit) — always read with `offset`/`limit`, or grep first to locate line numbers, since previous edits may shift line numbers slightly. Match on the exact code shown in each step, not on line numbers.

---

### Task 1: Merge the two OpenAlex card buttons into one

**Files:**
- Modify: `index.html` (CSS ~line 4888-4906, ~line 5991-6006; JS function `addOAButton` ~line 5947-5986)

- [ ] **Step 1: Locate the current `addOAButton` function and its CSS**

Run: `grep -n "function addOAButton" index.html` and `grep -n "openalex-works-btn{" index.html` to confirm current line numbers (they may have drifted from this plan's estimates).

- [ ] **Step 2: Replace `addOAButton` so the merged button opens the popup**

Find this exact block in `index.html`:

```js
  function addOAButton(card, oaData) {
    if (card.querySelector('.openalex-btn')) return;
    var foot = card.querySelector('.card-footer');
    if (!foot) return;
    var left = foot.querySelector('div');
    if (!left) return;

    var a = document.createElement('a');
    a.className = 'openalex-btn';
    a.href = oaData.id;
    a.target = '_blank';
    a.rel = 'noopener';
    attachTip(a, 'OpenAlex', [oaData.works_count.toLocaleString('fr-FR') + ' articles indexés']);

    var cnt = document.createElement('span');
    cnt.className = 'openalex-count';
    cnt.textContent = fmtCount(oaData.works_count);

    var img = document.createElement('img');
    img.className = 'openalex-logo';
    img.src = OA_LOGO;
    img.alt = 'OpenAlex';

    a.appendChild(cnt);
    a.appendChild(img);
    left.appendChild(a);

    var titleEl = card.querySelector('.card-title');
    var journalTitle = titleEl ? titleEl.textContent : '';

    var works = document.createElement('button');
    works.type = 'button';
    works.className = 'openalex-works-btn';
    works.innerHTML = '<span class="material-symbols-outlined">search</span>';
    if (typeof attachTip === 'function') attachTip(works, 'Découvrir les articles', ['Voir les articles indexés par OpenAlex']);
    works.addEventListener('click', function(){
      if (typeof window._oaOpenWorksModal === 'function') window._oaOpenWorksModal(oaData, journalTitle);
    });
    left.appendChild(works);
  }
```

Replace it with:

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
```

This drops the external `<a href>` navigation and the separate magnifier button; the single button now always opens the works popup (which still links out to OpenAlex via the clickable modal title, unchanged).

- [ ] **Step 3: Remove the now-dead `.openalex-works-btn` CSS rules**

Find this block (it sits at the top of the `<style id="openalex-works-css">` tag, immediately followed by the `#oa-works-modal` rules which must stay):

```css
  .openalex-works-btn{
    display:inline-flex; align-items:center; justify-content:center;
    width:34px; height:34px; border-radius:10px;
    border:1px solid rgba(0,100,200,.28); background:rgba(0,100,200,.07); color:#005ab0;
    cursor:pointer; flex:0 0 auto; padding:0;
    transition:background .18s ease,border-color .18s ease,color .18s ease,transform .15s ease,box-shadow .18s ease;
  }
  .openalex-works-btn .material-symbols-outlined{ font-size:17px; line-height:1; }
  .openalex-works-btn:hover{
    background:rgba(0,100,200,.16) !important; border-color:rgba(0,100,200,.55) !important;
    color:#003a80 !important; transform:translateY(-1px); box-shadow:0 6px 20px rgba(0,100,200,.18) !important;
  }
  html.dark .openalex-works-btn{ color:#70b8ff; border-color:rgba(112,184,255,.22); background:rgba(112,184,255,.08); }
  html.dark .openalex-works-btn:hover{ background:rgba(112,184,255,.18) !important; border-color:rgba(112,184,255,.5) !important; color:#b0d8ff !important; box-shadow:0 6px 20px rgba(112,184,255,.18) !important; }

  #oa-works-modal{
```

Delete everything from `.openalex-works-btn{` through the blank line just before `#oa-works-modal{`, keeping `#oa-works-modal{` and everything after it untouched.

- [ ] **Step 4: Make `.openalex-btn` safe to use as a `<button>`**

Find:

```css
  .openalex-btn{
    display:inline-flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:2px;
    padding:0 10px;
    min-width:52px;
    height:46px;
    border-radius:14px;
    border:1px solid rgba(0,100,200,.28);
    background:rgba(0,100,200,.07);
    color:#005ab0;
    text-decoration:none !important;
    cursor:pointer;
    flex:0 0 auto;
    transition:background .18s ease,border-color .18s ease,color .18s ease,transform .15s ease,box-shadow .18s ease;
    white-space:nowrap;
  }
```

Add `font-family:inherit;` to it (buttons don't inherit the page font by default; other button classes in this file, e.g. `.oa-topics-btn`, already do this):

```css
  .openalex-btn{
    display:inline-flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:2px;
    padding:0 10px;
    min-width:52px;
    height:46px;
    border-radius:14px;
    border:1px solid rgba(0,100,200,.28);
    background:rgba(0,100,200,.07);
    color:#005ab0;
    text-decoration:none !important;
    cursor:pointer;
    flex:0 0 auto;
    font-family:inherit;
    transition:background .18s ease,border-color .18s ease,color .18s ease,transform .15s ease,box-shadow .18s ease;
    white-space:nowrap;
  }
```

- [ ] **Step 5: Manually verify**

Open the preview (`{name: "OA-site"}`), navigate to the running page, and use `read_page` (filter: interactive) scoped to one journal card's footer. Confirm there is exactly one OpenAlex-related control (the merged button — logo + count, no separate magnifier icon). Click it with `computer` and confirm the works popup (`#oa-works-modal`) opens. Check `read_console_messages` for errors.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Merge the two per-card OpenAlex buttons into one that opens the works popup"
```

---

### Task 2: PDF/HTML availability gauge in the popup

**Files:**
- Modify: `index.html` (HTML ~line 6094; CSS near ~line 6020; JS near `renderPubYearChart`/`openWorksModal`, script `#openalex-works-modal`)

- [ ] **Step 1: Add the HTML block**

Find:

```html
    <div id="oa-pubyear-chart-wrap" class="oa-pubyear-chart-wrap">
      <div class="oa-pubyear-chart-title">Publications par an</div>
      <div id="oa-pubyear-chart" style="height:150px;"></div>
    </div>
```

Replace with:

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

- [ ] **Step 2: Add the CSS**

Find:

```css
  .oa-pubyear-chart-wrap{ display:none; margin:0 20px 16px; padding:12px 16px 4px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); flex-shrink:0; }
  .oa-pubyear-chart-title{ font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
```

Replace with:

```css
  .oa-pubyear-chart-wrap{ display:none; margin:0 20px 16px; padding:12px 16px 4px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); flex-shrink:0; }
  .oa-pubyear-chart-title{ font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
  .oa-availability-wrap{ display:none; align-items:center; gap:14px; margin:0 20px 16px; padding:12px 16px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); flex-shrink:0; }
  #oa-availability-gauge{ width:96px; height:96px; flex-shrink:0; }
  .oa-availability-pct{ font-size:15px; font-weight:800; color:var(--text); }
  .oa-availability-count{ font-size:12.5px; color:var(--muted); margin-top:2px; }
```

- [ ] **Step 3: Add `renderAvailabilityGauge` and `loadAvailability`**

Find the end of `renderPubYearChart` (it ends with a closing `}` right before `function loadSourceCard(sourceId, myToken){`):

```js
      tooltip: { trigger:'axis', valueFormatter:function(v){ return v + ' publication' + (v===1?'':'s'); } },
      textStyle: { color: textColor }
    });
  }

  function loadSourceCard(sourceId, myToken){
```

Replace with:

```js
      tooltip: { trigger:'axis', valueFormatter:function(v){ return v + ' publication' + (v===1?'':'s'); } },
      textStyle: { color: textColor }
    });
  }

  function renderAvailabilityGauge(withLink, total){
    var wrap = document.getElementById('oa-availability-wrap');
    var pctEl = document.getElementById('oa-availability-pct');
    var countEl = document.getElementById('oa-availability-count');
    if(!wrap) return;
    if(!total){ wrap.style.display = 'none'; return; }
    var pct = Math.round((withLink / total) * 100);
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

  function loadAvailability(sourceId, myToken){
    var wrap = document.getElementById('oa-availability-wrap');
    if(wrap) wrap.style.display = 'none';
    var base = 'https://api.openalex.org/works?filter=primary_location.source.id:' + encodeURIComponent(sourceId);
    Promise.all([
      fetch(base + '&per-page=1').then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }),
      fetch(base + ',open_access.oa_url:!null&per-page=1').then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; })
    ]).then(function(results){
      if(myToken !== state.token) return;
      var totalData = results[0], linkData = results[1];
      var total = totalData && totalData.meta ? totalData.meta.count : 0;
      var withLink = linkData && linkData.meta ? linkData.meta.count : 0;
      renderAvailabilityGauge(withLink, total);
    });
  }

  function loadSourceCard(sourceId, myToken){
```

`open_access.oa_url:!null` is the same signal `bestPdfUrl()`/`bestHtmlUrl()` fall back to for the per-article PDF/HTML buttons, so this gauge's percentage stays consistent with what's shown per article in the list below it. Both network calls only fetch `per-page=1` — we only read `meta.count`, not the results array, so this is cheap.

- [ ] **Step 4: Call `loadAvailability` from `openWorksModal`**

Find:

```js
    if(pubyearWrap) pubyearWrap.style.display = 'none';
    resetTopicsUI();
```

Replace with:

```js
    if(pubyearWrap) pubyearWrap.style.display = 'none';
    resetTopicsUI();
    loadAvailability(state.sourceId, state.token);
```

- [ ] **Step 5: Manually verify**

In the browser preview, open a journal's works popup. Confirm the availability block appears above "Publications par an" showing a gauge and a percentage/count line, and that the percentage looks plausible (compare a couple of visible PDF/HTML buttons in the list against the stated %). Open a second journal to confirm the gauge updates (not stuck on the previous journal's value) — `ecInit` disposes and recreates the chart instance each call, so this should just work. Check `read_console_messages` for errors, and test both light/dark mode (`resize_window` with `colorScheme`) to confirm gauge colors adapt.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Add PDF/HTML availability gauge to the OpenAlex works popup"
```

---

### Task 3: Rename the AI button and send the journal title to the Worker

**Files:**
- Modify: `index.html` (HTML ~line 6099; JS `resetTopicsUI` ~line 6337, `generateTopics` ~line 6375-6379)

- [ ] **Step 1: Rename the static button label**

Find:

```html
      <button id="oa-topics-btn" type="button" class="oa-topics-btn">
        <span class="material-symbols-outlined">auto_awesome</span>
        Générer les sujets principaux
      </button>
```

Replace with:

```html
      <button id="oa-topics-btn" type="button" class="oa-topics-btn">
        <span class="material-symbols-outlined">auto_awesome</span>
        Découvrir les sujets publiés par la revue
      </button>
```

- [ ] **Step 2: Rename the same label in `resetTopicsUI()`**

Find:

```js
    btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Générer les sujets principaux';
```

Replace with:

```js
    btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Découvrir les sujets publiés par la revue';
```

(Leave the `Régénérer` and `Réessayer` labels elsewhere in this file unchanged — only the initial label changes.)

- [ ] **Step 3: Send the journal title to the Worker**

Find:

```js
        return fetch(TOPICS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abstracts: abstracts })
        }).then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
```

Replace with:

```js
        return fetch(TOPICS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abstracts: abstracts, title: state.journalTitle })
        }).then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
```

- [ ] **Step 4: Manually verify**

Open a journal's works popup, confirm the button reads "Découvrir les sujets publiés par la revue". Open `read_network_requests` (or the Network tooling) after clicking it, find the `POST` to `.../topics`, and confirm the request body includes both `abstracts` and a non-empty `title` matching the journal's name.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "Rename AI topics button and send journal title to the /topics endpoint"
```

---

### Task 4: Rewrite the Worker's AI prompt into narrative style

**Files:**
- Modify: `worker/worker.js` (`/topics` handler, ~line 405-447)

- [ ] **Step 1: Replace the handler body**

Find:

```js
      const abstracts = Array.isArray(body && body.abstracts)
        ? body.abstracts.filter(a => typeof a === "string" && a.trim().length > 0)
        : [];

      if (!abstracts.length) {
        return new Response(JSON.stringify({ error: "no_abstracts" }), { status: 400, headers: CORS });
      }

      // Server-side caps, independent of what the frontend sends.
      const capped = abstracts.slice(0, 100);
      let combined = capped.join("\n\n---\n\n");
      if (combined.length > 8000) combined = combined.slice(0, 8000);

      try {
        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
          messages: [
            {
              role: "system",
              content: "Tu es un assistant qui analyse des résumés d'articles scientifiques et identifie les principaux thèmes de recherche d'une revue académique. Réponds uniquement en français, sous forme d'une liste concise de 5 à 8 thèmes (un thème par ligne, précédé d'un tiret), sans introduction ni conclusion."
            },
            { role: "user", content: combined }
          ],
          max_tokens: 400
        });
```

Replace with:

```js
      const abstracts = Array.isArray(body && body.abstracts)
        ? body.abstracts.filter(a => typeof a === "string" && a.trim().length > 0)
        : [];

      if (!abstracts.length) {
        return new Response(JSON.stringify({ error: "no_abstracts" }), { status: 400, headers: CORS });
      }

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

Everything below this (the `topics` extraction, error handling, response) stays exactly as-is — only the system/user messages, `title` extraction, and `max_tokens` changed.

- [ ] **Step 2: Review the diff**

Run: `git diff worker/worker.js` and confirm only the block above changed — no accidental edits to `/report-oa`, `/refresh`, `/csv`, or the cron handler.

- [ ] **Step 3: Commit**

```bash
git add worker/worker.js
git commit -m "Rewrite /topics prompt to generate narrative prose instead of a theme list"
```

- [ ] **Step 4: Flag the required manual deploy**

This change has no effect in production until deployed. After this task (and ideally after the whole plan is done and reviewed), run from `worker/`:

```bash
wrangler deploy
```

This step requires the Cloudflare account credentials tied to this Worker — do this yourself; it is not something to automate or run unattended.

---

### Task 5: Collapsible AI summary result

**Files:**
- Modify: `index.html` (JS `showTopicsResult` ~line 6324-6330; CSS `.oa-topics-result` ~line 6033-6037)

- [ ] **Step 1: Rewrite `showTopicsResult` to build a collapsible structure**

Find:

```js
  function showTopicsResult(text, isError){
    var result = document.getElementById('oa-topics-result');
    if(!result) return;
    result.textContent = text;
    result.className = 'oa-topics-result' + (isError ? ' error' : '');
    result.style.display = 'block';
  }
```

Replace with:

```js
  function showTopicsResult(text, isError){
    var result = document.getElementById('oa-topics-result');
    if(!result) return;
    result.innerHTML = '';
    result.className = 'oa-topics-result' + (isError ? ' error' : '');
    result.style.display = 'block';

    if(isError){
      result.textContent = text;
      return;
    }

    var textEl = document.createElement('div');
    textEl.className = 'oa-topics-text';
    textEl.textContent = text;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'oa-topics-collapse-btn';
    toggle.title = 'Réduire';
    toggle.innerHTML = '<span class="material-symbols-outlined">expand_less</span>';
    toggle.addEventListener('click', function(){
      var collapsed = result.classList.toggle('collapsed');
      toggle.title = collapsed ? 'Développer' : 'Réduire';
      toggle.innerHTML = '<span class="material-symbols-outlined">' + (collapsed ? 'expand_more' : 'expand_less') + '</span>';
    });

    result.appendChild(toggle);
    result.appendChild(textEl);
  }
```

Error messages (`isError === true`) stay plain text with no collapse button — only successful, generated summaries get the toggle.

- [ ] **Step 2: Add the CSS**

Find:

```css
  .oa-topics-result{
    margin-top:10px; padding:14px 16px; border:1px solid var(--card-border); border-radius:14px;
    background:var(--card); font-size:13px; line-height:1.7; color:var(--text); white-space:pre-line;
  }
  .oa-topics-result.error{ color:var(--muted); font-style:italic; }
```

Replace with:

```css
  .oa-topics-result{
    position:relative; margin-top:10px; padding:14px 40px 14px 16px; border:1px solid var(--card-border); border-radius:14px;
    background:var(--card); font-size:13px; line-height:1.7; color:var(--text);
  }
  .oa-topics-result.error{ color:var(--muted); font-style:italic; padding-right:16px; }
  .oa-topics-text{ white-space:pre-line; max-height:600px; overflow:hidden; transition:max-height .25s ease; }
  .oa-topics-result.collapsed .oa-topics-text{
    max-height:44px;
    -webkit-mask-image:linear-gradient(to bottom, #000 60%, transparent 100%);
    mask-image:linear-gradient(to bottom, #000 60%, transparent 100%);
  }
  .oa-topics-collapse-btn{
    position:absolute; top:10px; right:10px; display:inline-flex; align-items:center; justify-content:center;
    width:26px; height:26px; border-radius:8px; border:none; cursor:pointer;
    background:var(--chip-bg); color:var(--muted); padding:0;
  }
  .oa-topics-collapse-btn:hover{ color:var(--text); }
  .oa-topics-collapse-btn .material-symbols-outlined{ font-size:17px; line-height:1; }
```

(`white-space:pre-line` moves from `.oa-topics-result` onto the new `.oa-topics-text` child; everything else on `.oa-topics-result` is additive.)

- [ ] **Step 3: Manually verify**

Trigger (or rely on cached) topics generation for a journal, confirm the result box now shows a small chevron button in its top-right corner. Click it: the text should collapse to a short fading strip and the icon should flip to a "down" chevron; click again to re-expand, icon flips back. Reload the popup for the same journal (cached path through `resetTopicsUI`) and confirm the cached text still renders with a working toggle. Trigger an error path (e.g. temporarily block the network request, or check with an existing "insufficient abstracts" journal) and confirm error messages show as plain text with no toggle button.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Add collapse toggle to the generated AI summary"
```

---

### Task 6: Full manual walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Start the preview**

Use the browser preview tool with `{name: "OA-site"}`.

- [ ] **Step 2: Walk the golden path**

On the running page: find an African journal card with an OpenAlex button, confirm it's a single merged button, click it. In the popup, confirm (in order, top to bottom): title (linking out to OpenAlex), availability gauge with plausible %, "Publications par an" chart (if the journal has year data), the "Découvrir les sujets publiés par la revue" button, then the article list with working PDF/HTML per-article buttons.

- [ ] **Step 3: Exercise the AI summary + collapse**

Click "Découvrir les sujets publiés par la revue", wait for the result (this hits the currently-deployed Worker, so the text will still read as the OLD theme-list style until `wrangler deploy` is run — that's expected, not a bug). Confirm the collapse chevron appears and works. Close the popup and reopen the same journal — confirm the cached result reappears with a working toggle, and the availability gauge recomputes.

- [ ] **Step 4: Regression check**

Open a second, different journal and confirm: the gauge updates to the new journal's numbers, the AI summary area resets (no leftover text from the previous journal, button back to its initial label unless this journal also has a cache entry), and `read_console_messages` shows no new errors compared to a baseline load.

- [ ] **Step 5: Report back**

Summarize what was verified and remind the user that `worker/worker.js` still needs `wrangler deploy` (from `worker/`) before the narrative-style summary text goes live.

---

## Deployment reminder

Frontend changes (Tasks 1, 2, 3, 5) go live as soon as `index.html` is deployed/served normally — no extra step. The Worker change (Task 4) additionally requires `wrangler deploy` from `worker/`, run by the user.
