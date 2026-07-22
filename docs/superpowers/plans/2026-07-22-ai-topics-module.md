# Module IA "Sujets principaux de la revue" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button in the OpenAlex articles popup (`index.html`) that generates, on demand, a short list of the journal's main research topics using Cloudflare Workers AI (Llama 3.1, open-weight), based on abstracts fetched from OpenAlex.

**Architecture:** Frontend fetches up to 100 recent abstracts for the journal from OpenAlex, POSTs them to a new `/topics` endpoint on the existing Cloudflare Worker (`worker/worker.js`), which calls `env.AI.run()` and returns the generated text. No API key anywhere — Workers AI is bound directly to the Worker via `wrangler.toml`.

**Tech Stack:** Vanilla JS (existing IIFE pattern in `index.html`), Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct`), sessionStorage for client-side result caching.

**Spec:** `docs/superpowers/specs/2026-07-22-popup-cleanup-and-ai-topics-design.md` (section 3). Sections 1–2 of that spec (remove journal name per article, remove ISSN card) are already implemented and committed.

**Important limitation for verification:** This plan's backend tasks (wrangler.toml, worker.js) cannot be end-to-end tested in this session — there is no access to the user's Cloudflare account. The engineer must run `wrangler deploy` from `worker/` after implementation to activate the live `/topics` endpoint. Until deployed, the frontend's error-handling path (task 5) is what will actually be observed when clicking the button, which is itself a valid thing to verify.

---

### Task 1: Enable Cloudflare Workers AI binding

**Files:**
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: Add the `[ai]` binding**

Current end of file:
```toml
# Secret for /refresh endpoint — set with:
#   wrangler secret put REFRESH_SECRET
# (never put the actual value here)
```

Append after it:
```toml

# Workers AI binding — no API key needed, tied to this Cloudflare account.
# Used by the /topics endpoint to generate journal research-topic summaries.
[ai]
binding = "AI"
```

- [ ] **Step 2: Verify the file is valid TOML**

Run: `grep -A2 "\[ai\]" worker/wrangler.toml`
Expected output:
```
[ai]
binding = "AI"
```

- [ ] **Step 3: Commit**

```bash
git add worker/wrangler.toml
git commit -m "feat: add Cloudflare Workers AI binding for topics generation"
```

---

### Task 2: Add `/topics` endpoint to the Worker

**Files:**
- Modify: `worker/worker.js`

- [ ] **Step 1: Add the endpoint handler**

Find this block in `worker/worker.js` (the `/report-oa` handler ends with):
```js
        return new Response(JSON.stringify({ ok: true, stored: Object.keys(clean).length }), { headers: CORS });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false }), { status: 500, headers: CORS });
      }
    }

    // /refresh?secret=XXX — manual refresh (protect with a secret)
```

Insert a new block between the closing `}` of `/report-oa` and the `/refresh` comment, so it reads:
```js
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

      // Server-side caps, independent of what the frontend sends.
      const capped = abstracts.slice(0, 100);
      let combined = capped.join("\n\n---\n\n");
      if (combined.length > 8000) combined = combined.slice(0, 8000);

      try {
        const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            {
              role: "system",
              content: "Tu es un assistant qui analyse des résumés d'articles scientifiques et identifie les principaux thèmes de recherche d'une revue académique. Réponds uniquement en français, sous forme d'une liste concise de 5 à 8 thèmes (un thème par ligne, précédé d'un tiret), sans introduction ni conclusion."
            },
            { role: "user", content: combined }
          ],
          max_tokens: 400
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
```

- [ ] **Step 2: Verify the endpoint was added correctly**

Run: `grep -n "pathname === \"/topics\"\|env.AI.run\|no_abstracts\|ai_failed" worker/worker.js`
Expected: 4+ matching lines, including the route check, the `env.AI.run` call, and both error codes.

- [ ] **Step 3: Commit**

```bash
git add worker/worker.js
git commit -m "feat: add /topics endpoint using Cloudflare Workers AI"
```

---

### Task 3: Add the "Générer les sujets principaux" UI block (HTML + CSS)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Insert the HTML block between the pubyear chart and the article list**

Current code:
```html
    <div id="oa-pubyear-chart-wrap" class="oa-pubyear-chart-wrap">
      <div class="oa-pubyear-chart-title">Publications par an</div>
      <div id="oa-pubyear-chart" style="height:150px;"></div>
    </div>
    <div class="oa-works-body" id="oa-works-body"></div>
```

Replace with:
```html
    <div id="oa-pubyear-chart-wrap" class="oa-pubyear-chart-wrap">
      <div class="oa-pubyear-chart-title">Publications par an</div>
      <div id="oa-pubyear-chart" style="height:150px;"></div>
    </div>
    <div id="oa-topics-wrap" class="oa-topics-wrap">
      <button id="oa-topics-btn" type="button" class="oa-topics-btn">
        <span class="material-symbols-outlined">auto_awesome</span>
        Générer les sujets principaux
      </button>
      <div id="oa-topics-result" class="oa-topics-result" style="display:none;"></div>
    </div>
    <div class="oa-works-body" id="oa-works-body"></div>
```

- [ ] **Step 2: Add the CSS**

Find this line in `index.html` (in the `<style>` block right before `#oa-works-modal`):
```css
  .oa-pubyear-chart-title{ font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
```

Insert right after it:
```css
  .oa-topics-wrap{ margin:0 20px 16px; flex-shrink:0; }
  .oa-topics-btn{
    display:inline-flex; align-items:center; gap:7px; padding:9px 16px;
    border:1.5px solid var(--card-border); border-radius:12px;
    background:var(--card-solid); color:var(--text); font-size:13px; font-weight:700;
    font-family:inherit; cursor:pointer;
    transition:border-color .18s ease, color .18s ease, background .18s ease;
  }
  .oa-topics-btn:hover:not(:disabled){ border-color:var(--accent); color:var(--accent); }
  .oa-topics-btn:disabled{ opacity:.6; cursor:default; }
  .oa-topics-btn .material-symbols-outlined{ font-size:17px; }
  .oa-topics-result{
    margin-top:10px; padding:14px 16px; border:1px solid var(--card-border); border-radius:14px;
    background:var(--card); font-size:13px; line-height:1.7; color:var(--text); white-space:pre-line;
  }
  .oa-topics-result.error{ color:var(--muted); font-style:italic; }
```

- [ ] **Step 3: Verify**

Run: `grep -n "oa-topics-wrap\|oa-topics-btn\|oa-topics-result" index.html`
Expected: matches for both the HTML block and the 6 CSS rules (8+ total lines).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "style: add UI block for AI-generated journal topics"
```

---

### Task 4: Wire up the topics generation logic (JS)

**Files:**
- Modify: `index.html` (script `openalex-works-modal`)

- [ ] **Step 1: Add the `TOPICS_URL` constant and cache helpers**

Find:
```js
  var PER_PAGE = 25;
  var state = { sourceId: null, journalTitle: '', page: 1, loading: false, done: false, token: 0 };
```

Replace with:
```js
  var PER_PAGE = 25;
  var TOPICS_URL = 'https://doaj-african-cache.ynnonazaline.workers.dev/topics';
  var state = { sourceId: null, journalTitle: '', page: 1, loading: false, done: false, token: 0 };

  function getTopicsCache(){
    try { return JSON.parse(sessionStorage.getItem('oa-topics-cache') || '{}'); }
    catch(e){ return {}; }
  }
  function setTopicsCache(sourceId, text){
    try {
      var cache = getTopicsCache();
      cache[sourceId] = text;
      sessionStorage.setItem('oa-topics-cache', JSON.stringify(cache));
    } catch(e){}
  }
```

- [ ] **Step 2: Add `showTopicsResult`, `resetTopicsUI`, and `generateTopics`**

Find:
```js
  function closeModal(){
    var modal = document.getElementById('oa-works-modal');
    if(modal) modal.style.display = 'none';
  }
```

Insert right after it:
```js

  function showTopicsResult(text, isError){
    var result = document.getElementById('oa-topics-result');
    if(!result) return;
    result.textContent = text;
    result.className = 'oa-topics-result' + (isError ? ' error' : '');
    result.style.display = 'block';
  }

  function resetTopicsUI(){
    var btn = document.getElementById('oa-topics-btn');
    var result = document.getElementById('oa-topics-result');
    if(!btn || !result) return;
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Générer les sujets principaux';
    result.style.display = 'none';
    result.textContent = '';
    result.className = 'oa-topics-result';

    var cached = getTopicsCache()[state.sourceId];
    if(cached){
      showTopicsResult(cached, false);
      btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span>Régénérer';
    }
  }

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
          body: JSON.stringify({ abstracts: abstracts })
        }).then(function(r){ return r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)); })
          .then(function(json){
            if(myToken !== state.token) return;
            if(!json || !json.topics) return Promise.reject(new Error('empty'));
            setTopicsCache(sourceId, json.topics);
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

- [ ] **Step 3: Call `resetTopicsUI()` from `openWorksModal`**

Find:
```js
    if(pubyearWrap) pubyearWrap.style.display = 'none';

    var displayTitle = esc(state.journalTitle || 'Articles indexés');
```

Replace with:
```js
    if(pubyearWrap) pubyearWrap.style.display = 'none';
    resetTopicsUI();

    var displayTitle = esc(state.journalTitle || 'Articles indexés');
```

- [ ] **Step 4: Wire the click listener**

Find:
```js
  document.addEventListener('click', function(e){
    if(!e.target) return;
    if(e.target.id === 'oa-works-close' || e.target.id === 'oa-works-modal') closeModal();
  });
```

Replace with:
```js
  var topicsBtn = document.getElementById('oa-topics-btn');
  if(topicsBtn) topicsBtn.addEventListener('click', generateTopics);

  document.addEventListener('click', function(e){
    if(!e.target) return;
    if(e.target.id === 'oa-works-close' || e.target.id === 'oa-works-modal') closeModal();
  });
```

- [ ] **Step 5: Verify**

Run: `grep -n "function generateTopics\|function resetTopicsUI\|function showTopicsResult\|getTopicsCache\|topicsBtn.addEventListener" index.html`
Expected: all 5 matches present, no duplicates.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: wire up AI topics generation button in articles popup"
```

---

### Task 5: Manual verification in browser

**Files:** none (verification only)

- [ ] **Step 1: Start the local static server and open the site**

Use the existing `.claude/launch.json` config named `OA-site` (serves `DOAJ/OA` on port 3777) via the preview tool, then navigate to `http://localhost:3777/index.html`.

- [ ] **Step 2: Open an article popup and confirm the new button appears**

Click any journal card's OpenAlex search icon (`.openalex-works-btn`). Confirm:
- The "Générer les sujets principaux" button appears below the publications-per-year chart, above the article list
- It has the `auto_awesome` icon

- [ ] **Step 3: Click the button and confirm the pre-deployment error path works**

Since the Worker has not been deployed yet with the new `/topics` endpoint, clicking the button should:
1. Show "Analyse en cours…" briefly
2. Fall through to the catch handler (network 404 from the not-yet-deployed endpoint, or a resolved-but-error JSON) and display "Impossible de générer les sujets pour le moment." in the result box, with the button reverting to "Réessayer"

This confirms the frontend error-handling path is correct. It does **not** confirm the AI generation itself works — that requires deployment (see Task 6).

- [ ] **Step 4: Confirm the block resets when switching journals**

Close the popup, open a different journal's popup, and confirm the topics button/result area is back to its initial "Générer les sujets principaux" state (not showing the previous journal's error or result).

- [ ] **Step 5: No commit for this task** (verification only)

---

### Task 6: Deploy the Worker (user action required)

**Files:** none — this is a manual step for the user, not something this session can execute (no access to the user's Cloudflare account).

- [ ] **Step 1: Deploy**

From the `worker/` directory:
```bash
wrangler deploy
```

- [ ] **Step 2: Confirm the AI binding is active**

Check the Cloudflare dashboard (Workers & Pages → doaj-african-cache → Settings → Bindings) for an `AI` binding, or run:
```bash
wrangler tail
```
while clicking the "Générer les sujets principaux" button on the live site, to confirm the `/topics` request reaches the Worker and `env.AI.run()` executes without error.

- [ ] **Step 3: Re-test in browser**

Repeat Task 5 Step 3 on the live/deployed site — the button should now return a real list of topics instead of the error message.
