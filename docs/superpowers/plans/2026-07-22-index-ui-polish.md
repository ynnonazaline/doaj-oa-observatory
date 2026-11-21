# Polish titres, plein écran graphique, refonte popup articles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réduire la taille des titres du site, ajouter un bouton plein écran au graphique « Réseau d'indexation des revues », et refondre le popup « articles indexés » (theming sépia, nettoyage de champs, bouton PDF, résumé dépliable, subfield, lien HTML, langue, lien OpenAlex, graphique de publications par an).

**Architecture:** Site statique mono-fichier (`index.html`, vanilla JS, pas de build, pas de framework de test). Toutes les modifications sont des éditions ciblées de CSS/HTML/JS existant dans ce fichier. La vérification se fait par lecture/grep (contrôle automatisable) puis par test manuel dans le navigateur (aucun test unitaire n'existe dans ce projet).

**Tech Stack:** HTML/CSS/JS vanilla, ECharts (déjà chargé globalement), API OpenAlex (`api.openalex.org`).

**Fichier concerné (unique) :** `index.html` à la racine du repo `DOAJ/OA`.

---

## Rappel important pour l'exécutant

Ce projet n'a pas de suite de tests automatisée. Les étapes « test » de ce plan sont donc :
1. Un contrôle automatisable (grep/lecture du fichier) pour confirmer que l'édition a été appliquée textuellement.
2. Une vérification manuelle dans le navigateur (via l'outil de preview) décrite dans la dernière tâche, à faire une fois toutes les tâches de code terminées (le popup articles n'est testable de façon cohérente qu'une fois toutes ses sous-tâches posées).

Ne pas sauter les commits intermédiaires : chaque tâche doit être commit séparément pour permettre un rollback ciblé.

---

### Task 1: Réduction des titres du site (-10px sur les gros titres, plancher de lisibilité pour les petits)

**Files:**
- Modify: `index.html` (règles `.title`, `.section-title`, `.card-title` et leurs media queries)

- [ ] **Step 1: Réduire `.title` (titre d'en-tête, base + 3 media queries)**

Chercher et remplacer (base, autour de la ligne 486) :

```css
.title{
  font-size: clamp(21px, 2.8vw, 37px) !important;
  letter-spacing: -0.04em !important;
  font-weight: 800 !important;
}
```
→
```css
.title{
  font-size: clamp(15px, 2.8vw, 27px) !important;
  letter-spacing: -0.04em !important;
  font-weight: 800 !important;
}
```

Media query `@media (max-width: 980px)` (autour de la ligne 812), remplacer la ligne :
```css
      .title { font-size: clamp(19px, 4.5vw, 29px) !important; }
```
→
```css
      .title { font-size: clamp(14px, 4.5vw, 19px) !important; }
```

Media query `@media (max-width: 700px)` (autour de la ligne 830), remplacer :
```css
      .title {
        font-size: clamp(17px, 6.5vw, 25px) !important;
        line-height: 1.18 !important;
        letter-spacing: -0.03em !important;
      }
```
→
```css
      .title {
        font-size: clamp(13px, 6.5vw, 15px) !important;
        line-height: 1.18 !important;
        letter-spacing: -0.03em !important;
      }
```

Media query `@media (max-width: 420px)` (autour de la ligne 1015), remplacer :
```css
      .title { font-size: clamp(15px, 7.5vw, 21px) !important; }
```
→
```css
      .title { font-size: clamp(12px, 7.5vw, 13px) !important; }
```

- [ ] **Step 2: Réduire `.section-title` (base + 2 media queries)**

Base (autour de la ligne 617), remplacer :
```css
.section-title{
  font-size:clamp(1.09rem, 1.82vw, 1.71rem) !important;
  font-weight:780 !important;
  margin-bottom:8px !important;
}
```
→
```css
.section-title{
  font-size:clamp(0.8125rem, 1.82vw, 1.085rem) !important;
  font-weight:780 !important;
  margin-bottom:8px !important;
}
```

`@media (max-width: 700px)` (autour de la ligne 844), remplacer la ligne :
```css
      .section-title { font-size: 0.91rem !important; gap: 6px; margin-bottom: 6px !important; }
```
→
```css
      .section-title { font-size: 0.8125rem !important; gap: 6px; margin-bottom: 6px !important; }
```

`@media (max-width: 420px)` (autour de la ligne 1014), remplacer :
```css
      .section-title { font-size: 0.82rem !important; }
```
→
```css
      .section-title { font-size: 0.75rem !important; }
```

- [ ] **Step 3: Réduire `.card-title` (base + 2 media queries) vers un plancher commun de 13px**

Base (autour de la ligne 642), remplacer :
```css
.card-title{
  font-size:17px !important;
  font-weight:780 !important;
}
```
→
```css
.card-title{
  font-size:13px !important;
  font-weight:780 !important;
}
```

`@media (max-width: 700px)` (autour de la ligne 908), remplacer :
```css
      .card-title { font-size: 15px !important; padding-right: 26px !important; }
```
→
```css
      .card-title { font-size: 13px !important; padding-right: 26px !important; }
```

`@media (max-width: 420px)` (autour de la ligne 1029), remplacer :
```css
      .card-title { font-size: 14.5px !important; padding-right: 22px !important; }
```
→
```css
      .card-title { font-size: 13px !important; padding-right: 22px !important; }
```

- [ ] **Step 4: Vérifier textuellement les 8 remplacements**

Run: `grep -n "clamp(15px, 2.8vw, 27px)\|clamp(14px, 4.5vw, 19px)\|clamp(13px, 6.5vw, 15px)\|clamp(12px, 7.5vw, 13px)\|clamp(0.8125rem, 1.82vw, 1.085rem)\|font-size: 0.8125rem !important; gap: 6px\|font-size: 0.75rem !important;\|font-size:13px !important;\|font-size: 13px !important; padding-right: 26px\|font-size: 13px !important; padding-right: 22px" "index.html"`

Expected: 10 lignes trouvées (une par occurrence remplacée — `font-size:13px !important;` apparaît pour la règle de base `.card-title`, à distinguer visuellement des deux lignes media query qui ont une syntaxe légèrement différente avec espace après `:`).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "style: reduce site title sizes (hero, section, card titles)"
```

---

### Task 2: Bouton plein écran — graphique « Réseau d'indexation des revues »

**Files:**
- Modify: `index.html` (CSS ~ligne 141-144, HTML ~ligne 1333, JS ~ligne 3112)

- [ ] **Step 1: Ajouter la règle CSS `:fullscreen` pour le graphique**

Chercher (autour de la ligne 141) :
```css
    #viz-map-wrap { position: relative; }
    #viz-map:fullscreen,
    #viz-map:-webkit-full-screen,
    #viz-map:-moz-full-screen { height: 100vh !important; width: 100vw !important; border-radius: 0 !important; }
```
Remplacer par :
```css
    #viz-map-wrap { position: relative; }
    #viz-map:fullscreen,
    #viz-map:-webkit-full-screen,
    #viz-map:-moz-full-screen { height: 100vh !important; width: 100vw !important; border-radius: 0 !important; }
    #viz-indexation-graph-wrap { position: relative; }
    #viz-indexation-graph:fullscreen,
    #viz-indexation-graph:-webkit-full-screen,
    #viz-indexation-graph:-moz-full-screen { height: 100vh !important; width: 100vw !important; border-radius: 0 !important; background: var(--bg); }
```

- [ ] **Step 2: Envelopper le conteneur du graphique et ajouter le bouton**

Chercher (autour de la ligne 1333) :
```html
        <div id="viz-indexation-graph" style="height:640px;border-radius:14px;overflow:hidden;"></div>
```
Remplacer par :
```html
        <div id="viz-indexation-graph-wrap" style="position: relative;">
          <div id="viz-indexation-graph" style="height:640px;border-radius:14px;overflow:hidden;"></div>
          <button id="btn-indexation-fullscreen" class="btn btn-outline" title="Plein écran" style="position: absolute; top: 10px; right: 10px; z-index: 1000; background: var(--card); backdrop-filter: var(--blur); -webkit-backdrop-filter: var(--blur);">
            <span class="material-symbols-outlined" style="font-size:16px;line-height:1;">fullscreen</span> Plein écran
          </button>
        </div>
```

- [ ] **Step 3: Ajouter le handler JS de plein écran**

Chercher (autour de la ligne 3105-3122) :
```js
  document.getElementById("btn-map-fullscreen").onclick = ()=>{
    const mapEl = document.getElementById("viz-map");
    if (!document.fullscreenElement){
      mapEl.requestFullscreen && mapEl.requestFullscreen().catch(()=>{});
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  };
  document.addEventListener('fullscreenchange', ()=>{
    setTimeout(()=>{ if (leafletMap) leafletMap.invalidateSize(); }, 120);
    const btn = document.getElementById("btn-map-fullscreen");
    if (btn){
      const isFs = !!document.fullscreenElement;
      btn.innerHTML = isFs
        ? '<span class="material-symbols-outlined" style="font-size:16px;line-height:1;">fullscreen_exit</span> Quitter plein écran'
        : '<span class="material-symbols-outlined" style="font-size:16px;line-height:1;">fullscreen</span> Plein écran';
    }
  });
```
Remplacer par (ajoute le nouveau bloc juste après, sans toucher au bloc existant) :
```js
  document.getElementById("btn-map-fullscreen").onclick = ()=>{
    const mapEl = document.getElementById("viz-map");
    if (!document.fullscreenElement){
      mapEl.requestFullscreen && mapEl.requestFullscreen().catch(()=>{});
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  };
  document.addEventListener('fullscreenchange', ()=>{
    setTimeout(()=>{ if (leafletMap) leafletMap.invalidateSize(); }, 120);
    const btn = document.getElementById("btn-map-fullscreen");
    if (btn){
      const isFs = !!document.fullscreenElement;
      btn.innerHTML = isFs
        ? '<span class="material-symbols-outlined" style="font-size:16px;line-height:1;">fullscreen_exit</span> Quitter plein écran'
        : '<span class="material-symbols-outlined" style="font-size:16px;line-height:1;">fullscreen</span> Plein écran';
    }
  });

  document.getElementById("btn-indexation-fullscreen").onclick = ()=>{
    const graphEl = document.getElementById("viz-indexation-graph");
    if (!document.fullscreenElement){
      graphEl.requestFullscreen && graphEl.requestFullscreen().catch(()=>{});
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  };
  document.addEventListener('fullscreenchange', ()=>{
    setTimeout(()=>{ window.dispatchEvent(new Event('resize')); }, 120);
    const graphEl = document.getElementById("viz-indexation-graph");
    const btn = document.getElementById("btn-indexation-fullscreen");
    if (btn){
      const isGraphFs = document.fullscreenElement === graphEl;
      btn.innerHTML = isGraphFs
        ? '<span class="material-symbols-outlined" style="font-size:16px;line-height:1;">fullscreen_exit</span> Quitter plein écran'
        : '<span class="material-symbols-outlined" style="font-size:16px;line-height:1;">fullscreen</span> Plein écran';
    }
  });
```

Note technique : le graphique ECharts du réseau d'indexation écoute déjà `window.addEventListener('resize', ...)` pour se redimensionner (ligne ~6701) — déclencher un `resize` synthétique après le changement de plein écran suffit à le faire réagir, sans avoir besoin d'exposer l'instance `_chart` en dehors de son IIFE.

- [ ] **Step 4: Vérifier textuellement les 3 ajouts**

Run: `grep -n "btn-indexation-fullscreen\|viz-indexation-graph-wrap\|viz-indexation-graph:fullscreen" "index.html"`

Expected: au moins 5 lignes (1 CSS rule block avec 3 sélecteurs, 1 wrapper HTML, 1 bouton HTML, 2 références JS `getElementById("btn-indexation-fullscreen")`).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add fullscreen button to indexation network graph"
```

---

### Task 3: Correction des couleurs sépia du popup (bug de variables CSS)

**Cause racine :** les variables `--text`, `--muted`, `--card`, `--card-solid`, `--card-border`, `--accent`, `--chip-bg`, etc. utilisées par le popup ne sont définies que dans `html:not(.dark)` et `html.dark`. Le sélecteur `html:not(.dark)` matche aussi `.sepia` (qui n'a pas la classe `dark`), donc le popup hérite toujours des couleurs du thème clair en mode sépia — aucune de ces variables n'est redéfinie pour `.sepia`.

**Files:**
- Modify: `index.html` (bloc `#azilan-theme-keywords-patch`, autour de la ligne 4648-4651)

- [ ] **Step 1: Ajouter un bloc de variables CSS pour `html.sepia`**

Chercher (autour de la ligne 4644-4651) :
```css
  html.dark textarea{
    background:#0d1117 !important;
    border-color:rgba(148,163,184,.16) !important;
    color:#f5f7fb !important;
  }

  
  html.sepia body{
```
Remplacer par :
```css
  html.dark textarea{
    background:#0d1117 !important;
    border-color:rgba(148,163,184,.16) !important;
    color:#f5f7fb !important;
  }

  
  html.sepia{
    --bg:#f2e8d5 !important;
    --bg-soft:#ede0c4 !important;
    --text:#2c1a0a !important;
    --muted:#7c4a1e !important;
    --card:rgba(250,244,230,.88) !important;
    --card-solid:#f7f0dd !important;
    --card-border:rgba(160,115,60,.22) !important;
    --shadow:0 14px 30px rgba(80,40,0,.10) !important;
    --accent:#b45309 !important;
    --accent-strong:#92400e !important;
    --accent2:#a16207 !important;
    --chip-bg:rgba(180,80,30,.10) !important;
    --badge-bg:rgba(180,80,30,.12) !important;
    --select-bg:#faf4e6 !important;
    --option-bg:#faf4e6 !important;
    --option-text:#2c1a0a !important;
    --btn-outline-text:#2c1a0a !important;
  }
  html.sepia body{
```

Cette nouvelle règle `html.sepia{...}` est placée après les blocs `html:not(.dark)` (ligne ~4481) et `html.dark` (ligne ~4548) dans le fichier : à spécificité CSS égale (toutes utilisent `!important`), c'est l'ordre dans la feuille de style qui décide, donc ce nouveau bloc l'emporte bien pour tout élément portant la classe `sepia`.

- [ ] **Step 2: Vérifier textuellement l'ajout**

Run: `grep -n -- "--accent:#b45309 !important;" "index.html"`

Expected: 1 ligne trouvée (dans le nouveau bloc `html.sepia{...}`).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: define CSS theme variables for sepia mode (fixes popup colors)"
```

---

### Task 4: Carte source du popup (ISSN uniquement), lien OpenAlex sur le titre, graphique des publications par an

**Files:**
- Modify: `index.html` :
  - HTML du popup (`#oa-works-modal`, ~ligne 5999-6008)
  - CSS `#openalex-works-css` (~ligne 5959-5975, ajouts)
  - JS `openalex-works-modal` : `renderSourceCard`, `loadSourceCard`, `openWorksModal` (~ligne 6142-6199)

**Contexte data :** l'objet source OpenAlex (`oaData`, qu'il vienne de la résolution directe via `/sources?filter=issn:...` ou du fetch complet `/sources/{id}`) contient déjà `counts_by_year` (tableau `{year, works_count, cited_by_count}`) — pas de nouvel appel réseau nécessaire. Seul le cas du cache d'enrichissement pré-résolu (`{id, works_count}`) ne l'a pas, mais ce cas déclenche déjà `loadSourceCard()` qui va chercher l'objet complet.

- [ ] **Step 1: Ajouter le conteneur HTML du graphique de publications par an**

Chercher (autour de la ligne 5999-6008) :
```html
<div id="oa-works-modal">
  <div class="oa-works-inner">
    <div class="oa-works-head">
      <div class="oa-works-head-title" id="oa-works-title"></div>
      <button class="oa-works-close" id="oa-works-close" title="Fermer" aria-label="Fermer">&#x2715;</button>
    </div>
    <div class="oa-source-card" id="oa-source-card"></div>
    <div class="oa-works-body" id="oa-works-body"></div>
  </div>
</div>
```
Remplacer par :
```html
<div id="oa-works-modal">
  <div class="oa-works-inner">
    <div class="oa-works-head">
      <div class="oa-works-head-title" id="oa-works-title"></div>
      <button class="oa-works-close" id="oa-works-close" title="Fermer" aria-label="Fermer">&#x2715;</button>
    </div>
    <div class="oa-source-card" id="oa-source-card"></div>
    <div id="oa-pubyear-chart-wrap" class="oa-pubyear-chart-wrap">
      <div class="oa-pubyear-chart-title">Publications par an</div>
      <div id="oa-pubyear-chart" style="height:150px;"></div>
    </div>
    <div class="oa-works-body" id="oa-works-body"></div>
  </div>
</div>
```

- [ ] **Step 2: Ajouter le CSS du graphique et du lien de titre**

Chercher (autour de la ligne 5970-5973) :
```css
  .oa-source-card{ margin:0 20px 16px; padding:14px 16px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); font-size:13px; color:var(--text); flex-shrink:0; }
  .oa-source-row{ line-height:1.9; }
  .oa-source-row strong{ font-weight:700; margin-right:5px; }
  .oa-source-divider{ height:1px; background:var(--card-border); margin:6px 0; }
```
Remplacer par :
```css
  .oa-source-card{ margin:0 20px 16px; padding:14px 16px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); font-size:13px; color:var(--text); flex-shrink:0; }
  .oa-source-row{ line-height:1.9; }
  .oa-source-row strong{ font-weight:700; margin-right:5px; }
  .oa-source-divider{ height:1px; background:var(--card-border); margin:6px 0; }
  .oa-works-title-link{ color:inherit; text-decoration:none; }
  .oa-works-title-link:hover{ color:var(--accent); text-decoration:underline; }
  .oa-pubyear-chart-wrap{ display:none; margin:0 20px 16px; padding:12px 16px 4px; border:1px solid var(--card-border); border-radius:14px; background:var(--card); flex-shrink:0; }
  .oa-pubyear-chart-title{ font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:2px; }
```

- [ ] **Step 3: Réécrire `renderSourceCard` (ISSN uniquement + déclenche le graphique)**

Chercher (autour de la ligne 6142-6153) :
```js
  function renderSourceCard(oaData){
    var sourceCard = document.getElementById('oa-source-card');
    if(!sourceCard) return;
    var issnList = (oaData.issn && oaData.issn.length) ? oaData.issn.join(', ') : (oaData.issn_l || '—');
    sourceCard.innerHTML =
      '<div class="oa-source-row"><strong>ISSN :</strong>' + esc(issnList) + '</div>'
      + '<div class="oa-source-row"><strong>Type de source :</strong>' + esc(oaData.type || '—') + '</div>'
      + '<div class="oa-source-row"><strong>Éditeur :</strong>' + esc(oaData.host_organization_name || '—') + '</div>'
      + '<div class="oa-source-divider"></div>'
      + '<div class="oa-source-row"><strong>Accès ouvert :</strong>' + (oaData.is_oa ? 'Oui' : 'Non') + '</div>'
      + '<div class="oa-source-row"><strong>Dans le DOAJ :</strong>' + (oaData.is_in_doaj ? 'Oui' : 'Non') + '</div>';
  }
```
Remplacer par :
```js
  function renderSourceCard(oaData){
    var sourceCard = document.getElementById('oa-source-card');
    if(!sourceCard) return;
    var issnList = (oaData.issn && oaData.issn.length) ? oaData.issn.join(', ') : (oaData.issn_l || '—');
    sourceCard.innerHTML = '<div class="oa-source-row"><strong>ISSN :</strong>' + esc(issnList) + '</div>';
    renderPubYearChart(oaData.counts_by_year);
  }

  function renderPubYearChart(countsByYear){
    var wrap = document.getElementById('oa-pubyear-chart-wrap');
    if(!wrap) return;
    var data = (countsByYear || [])
      .filter(function(c){ return c && c.year; })
      .sort(function(a,b){ return a.year - b.year; });
    if(!data.length){ wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    var chart = ecInit('oa-pubyear-chart');
    if(!chart) return;
    var dark = isDark(), sepia = isSepia();
    var textColor   = dark ? 'rgba(245,247,251,.82)' : sepia ? '#2c1a0a' : '#1e293b';
    var mutedColor  = dark ? 'rgba(245,247,251,.42)' : sepia ? '#7c4a1e' : '#64748b';
    var accentColor = dark ? '#93c5fd' : sepia ? '#b45309' : '#2563eb';
    chart.setOption({
      grid: { left: 36, right: 12, top: 14, bottom: 24 },
      xAxis: { type:'category', data: data.map(function(c){ return c.year; }), axisLine:{lineStyle:{color:mutedColor}}, axisLabel:{color:mutedColor, fontSize:11} },
      yAxis: { type:'value', axisLine:{show:false}, splitLine:{lineStyle:{color:'rgba(148,163,184,.14)'}}, axisLabel:{color:mutedColor, fontSize:11} },
      series: [{ type:'line', data: data.map(function(c){ return c.works_count; }), smooth:true, symbolSize:5, lineStyle:{color:accentColor,width:2.5}, itemStyle:{color:accentColor}, areaStyle:{color:accentColor, opacity:.12} }],
      tooltip: { trigger:'axis', valueFormatter:function(v){ return v + ' publication' + (v===1?'':'s'); } },
      textStyle: { color: textColor }
    });
  }
```

- [ ] **Step 4: Rendre le titre de la revue cliquable vers OpenAlex, et masquer le graphique tant que rien n'est chargé**

Chercher (autour de la ligne 6167-6198) :
```js
  function openWorksModal(oaData, journalTitle){
    var modal = document.getElementById('oa-works-modal');
    var body = document.getElementById('oa-works-body');
    var titleEl = document.getElementById('oa-works-title');
    var sourceCard = document.getElementById('oa-source-card');
    if(!modal || !body || !oaData) return;

    state.token += 1;
    state.sourceId = extractSourceId(oaData.id);
    state.journalTitle = journalTitle || oaData.display_name || '';
    state.page = 1;
    state.loading = false;
    state.done = false;

    titleEl.textContent = state.journalTitle || 'Articles indexés';
```
Remplacer par :
```js
  function openWorksModal(oaData, journalTitle){
    var modal = document.getElementById('oa-works-modal');
    var body = document.getElementById('oa-works-body');
    var titleEl = document.getElementById('oa-works-title');
    var sourceCard = document.getElementById('oa-source-card');
    var pubyearWrap = document.getElementById('oa-pubyear-chart-wrap');
    if(!modal || !body || !oaData) return;

    state.token += 1;
    state.sourceId = extractSourceId(oaData.id);
    state.journalTitle = journalTitle || oaData.display_name || '';
    state.page = 1;
    state.loading = false;
    state.done = false;

    if(pubyearWrap) pubyearWrap.style.display = 'none';

    var displayTitle = esc(state.journalTitle || 'Articles indexés');
    titleEl.innerHTML = oaData.id
      ? '<a href="' + esc(oaData.id) + '" target="_blank" rel="noopener" class="oa-works-title-link">' + displayTitle + '</a>'
      : displayTitle;
```

- [ ] **Step 5: Vérifier textuellement les changements**

Run: `grep -n "oa-pubyear-chart\|renderPubYearChart\|oa-works-title-link" "index.html"`

Expected: au moins 8 occurrences (div wrap, div title, div chart, CSS x2, fonction, appel dans renderSourceCard, lien dans openWorksModal).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: simplify source card to ISSN, link journal title to OpenAlex, add publications-per-year chart"
```

---

### Task 5: Redesign visuel des boutons PDF/HTML au survol (CSS uniquement)

**Files:**
- Modify: `index.html` (CSS `#openalex-works-css`, ~ligne 5985-5996)

- [ ] **Step 1: Remplacer le style du bouton PDF et préparer les styles HTML/subfield/résumé**

Chercher (autour de la ligne 5985-5996) :
```css
  .oa-work-journal{ font-style:italic; }
  .oa-work-cited{ display:inline-flex; align-items:center; gap:2px; vertical-align:middle; }
  .oa-work-cited .material-symbols-outlined{ font-size:13px; }
  .oa-work-pdf-btn{
    flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
    padding:7px 16px; border:1.5px solid var(--card-border); border-radius:10px;
    font-size:12px; font-weight:700; color:var(--text); text-decoration:none;
    background:var(--card-solid); transition:border-color .15s ease, color .15s ease;
  }
  .oa-work-pdf-btn:hover{ border-color:var(--accent); color:var(--accent); }
  .oa-work-pdf-btn.disabled{ color:var(--muted); opacity:.5; cursor:default; pointer-events:none; }
  .oa-works-loadmore{ display:flex; gap:7px; align-items:center; justify-content:center; margin:12px auto 4px; padding:9px 18px; font-size:13px; }
  .oa-works-state{ padding:30px 10px; text-align:center; color:var(--muted); font-size:13px; }
</style>
```
Remplacer par :
```css
  .oa-work-journal{ font-style:italic; }
  .oa-work-subfield{
    display:inline-block; margin-top:6px; padding:2px 9px; border-radius:20px;
    font-size:11px; font-weight:700; color:var(--accent); background:var(--chip-bg);
  }
  .oa-work-abstract-toggle{
    display:inline-flex; align-items:center; gap:4px; margin-top:8px; padding:0;
    background:none; border:none; cursor:pointer; color:var(--accent);
    font-size:12px; font-weight:700; font-family:inherit;
  }
  .oa-work-abstract-toggle .material-symbols-outlined{ font-size:16px; transition:transform .2s ease; }
  .oa-work-abstract-toggle.expanded .material-symbols-outlined{ transform:rotate(180deg); }
  .oa-work-abstract{
    max-height:0; overflow:hidden; font-size:12.5px; line-height:1.65; color:var(--muted);
    transition:max-height .3s ease, margin-top .3s ease;
  }
  .oa-work-abstract.expanded{ max-height:1000px; margin-top:8px; }
  .oa-work-actions{ display:flex; flex-direction:column; gap:8px; flex-shrink:0; }
  .oa-work-pdf-btn, .oa-work-html-btn{
    display:inline-flex; align-items:center; justify-content:center; gap:6px;
    padding:7px 16px; border:1.5px solid var(--card-border); border-radius:10px;
    font-size:12px; font-weight:700; color:var(--text); text-decoration:none;
    background:var(--card-solid);
    transition:border-color .18s ease, color .18s ease, background .18s ease, transform .18s ease, box-shadow .18s ease;
  }
  .oa-work-pdf-btn .material-symbols-outlined, .oa-work-html-btn .material-symbols-outlined{ font-size:15px; }
  .oa-work-pdf-btn:hover{
    border-color:#ef4444; color:#ef4444;
    background:linear-gradient(135deg, rgba(239,68,68,.12), rgba(239,68,68,.04));
    transform:translateY(-2px); box-shadow:0 8px 20px rgba(239,68,68,.18);
  }
  .oa-work-html-btn:hover{
    border-color:var(--accent); color:var(--accent);
    background:linear-gradient(135deg, rgba(37,99,235,.12), rgba(37,99,235,.04));
    transform:translateY(-2px); box-shadow:0 8px 20px rgba(37,99,235,.18);
  }
  .oa-work-pdf-btn.disabled{ color:var(--muted); opacity:.5; cursor:default; pointer-events:none; transform:none; box-shadow:none; }
  .oa-works-loadmore{ display:flex; gap:7px; align-items:center; justify-content:center; margin:12px auto 4px; padding:9px 18px; font-size:13px; }
  .oa-works-state{ padding:30px 10px; text-align:center; color:var(--muted); font-size:13px; }
</style>
```

- [ ] **Step 2: Ajuster l'alignement de `.oa-work-item` (le contenu peut maintenant varier en hauteur à cause du résumé dépliable)**

Chercher (autour de la ligne 5976) :
```css
  .oa-work-item{ display:flex; align-items:center; gap:14px; padding:14px 0; border-bottom:1px solid var(--card-border); }
```
Remplacer par :
```css
  .oa-work-item{ display:flex; align-items:flex-start; gap:14px; padding:14px 0; border-bottom:1px solid var(--card-border); }
```

- [ ] **Step 3: Vérifier textuellement les changements**

Run: `grep -n "oa-work-html-btn\|oa-work-abstract\|oa-work-subfield\|oa-work-actions" "index.html"`

Expected: plusieurs occurrences CSS (les usages JS arrivent à la tâche suivante, donc ces classes ne sont pas encore utilisées dans le HTML généré — c'est attendu à ce stade).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "style: redesign PDF/HTML buttons hover state, add styles for abstract/subfield"
```

---

### Task 6: Enrichissement de chaque article (JS `renderWork`) — retrait citations, ajout subfield, langue, résumé dépliable, lien HTML

**Files:**
- Modify: `index.html` (script `openalex-works-modal`, fonctions ~ligne 6023-6078)

**Contexte data OpenAlex (aucun nouvel appel réseau — tout vient de l'objet `work` déjà renvoyé par `/works`, qui n'utilise pas de paramètre `select=` limitant les champs) :**
- `work.abstract_inverted_index` : résumé au format inversé `{mot: [positions...]}`, à reconstruire.
- `work.primary_topic.subfield.display_name` : sous-discipline.
- `work.language` : code ISO (ex: `"fr"`, `"en"`), à afficher en toutes lettres via `Intl.DisplayNames`.
- `work.best_oa_location.landing_page_url` (avec repli sur `work.primary_location.landing_page_url`) : page HTML de l'éditeur, à afficher si différente du PDF.

- [ ] **Step 1: Remplacer les fonctions utilitaires et `renderWork`**

Chercher (autour des lignes 6023-6078) :
```js
  function bestPdfUrl(work){
    return (work.best_oa_location && work.best_oa_location.pdf_url)
      || (work.open_access && work.open_access.oa_url)
      || (work.primary_location && work.primary_location.pdf_url)
      || null;
  }

  function esc(value){
    return typeof safeEscape === 'function' ? safeEscape(value) : String(value == null ? '' : value);
  }

  function authorsHtml(work){
    var authors = ((work.authorships) || []).map(function(a){ return a.author; }).filter(Boolean);
    if(!authors.length) return 'Auteurs inconnus';
    var shown = authors.slice(0,3).map(function(au){
      var name = esc(au.display_name || 'Auteur inconnu');
      return au.id ? ('<a href="' + au.id + '" target="_blank" rel="noopener">' + name + '</a>') : name;
    }).join(', ');
    return authors.length > 3 ? (shown + ' et al.') : shown;
  }

  function renderWork(work){
    var item = document.createElement('div');
    item.className = 'oa-work-item';

    var main = document.createElement('div');
    main.className = 'oa-work-main';

    var title = document.createElement('a');
    title.className = 'oa-work-title';
    title.href = work.id || '#';
    title.target = '_blank';
    title.rel = 'noopener';
    title.textContent = work.title || work.display_name || 'Titre indisponible';
    main.appendChild(title);

    var meta = document.createElement('div');
    meta.className = 'oa-work-meta';
    var cited = work.cited_by_count || 0;
    meta.innerHTML = (work.publication_year || '?') + ' · ' + authorsHtml(work)
      + ' · <span class="oa-work-journal">' + esc(state.journalTitle || '') + '</span>'
      + ' · <span class="oa-work-cited"><span class="material-symbols-outlined">format_quote</span>' + cited + '</span>';
    main.appendChild(meta);

    item.appendChild(main);

    var pdfUrl = bestPdfUrl(work);
    var pdf = document.createElement(pdfUrl ? 'a' : 'span');
    pdf.className = 'oa-work-pdf-btn' + (pdfUrl ? '' : ' disabled');
    if(pdfUrl){ pdf.href = pdfUrl; pdf.target = '_blank'; pdf.rel = 'noopener'; pdf.title = 'Télécharger le PDF'; }
    else { pdf.title = 'PDF non disponible'; }
    pdf.textContent = 'PDF';
    item.appendChild(pdf);

    return item;
  }
```
Remplacer par :
```js
  function bestPdfUrl(work){
    return (work.best_oa_location && work.best_oa_location.pdf_url)
      || (work.open_access && work.open_access.oa_url)
      || (work.primary_location && work.primary_location.pdf_url)
      || null;
  }

  function bestHtmlUrl(work, pdfUrl){
    var landing = (work.best_oa_location && work.best_oa_location.landing_page_url)
      || (work.primary_location && work.primary_location.landing_page_url)
      || null;
    return (landing && landing !== pdfUrl) ? landing : null;
  }

  function invertedIndexToText(idx){
    if(!idx) return '';
    var maxPos = -1;
    Object.keys(idx).forEach(function(word){
      idx[word].forEach(function(pos){ if(pos > maxPos) maxPos = pos; });
    });
    if(maxPos < 0) return '';
    var words = new Array(maxPos + 1);
    Object.keys(idx).forEach(function(word){
      idx[word].forEach(function(pos){ words[pos] = word; });
    });
    return words.filter(Boolean).join(' ');
  }

  var LANG_NAMES = (typeof Intl !== 'undefined' && Intl.DisplayNames) ? new Intl.DisplayNames(['fr'], {type:'language'}) : null;
  function languageLabel(code){
    if(!code) return '';
    try { return (LANG_NAMES && LANG_NAMES.of(code)) || code.toUpperCase(); }
    catch(e){ return code.toUpperCase(); }
  }

  function esc(value){
    return typeof safeEscape === 'function' ? safeEscape(value) : String(value == null ? '' : value);
  }

  function authorsHtml(work){
    var authors = ((work.authorships) || []).map(function(a){ return a.author; }).filter(Boolean);
    if(!authors.length) return 'Auteurs inconnus';
    var shown = authors.slice(0,3).map(function(au){
      var name = esc(au.display_name || 'Auteur inconnu');
      return au.id ? ('<a href="' + au.id + '" target="_blank" rel="noopener">' + name + '</a>') : name;
    }).join(', ');
    return authors.length > 3 ? (shown + ' et al.') : shown;
  }

  function renderWork(work){
    var item = document.createElement('div');
    item.className = 'oa-work-item';

    var main = document.createElement('div');
    main.className = 'oa-work-main';

    var title = document.createElement('a');
    title.className = 'oa-work-title';
    title.href = work.id || '#';
    title.target = '_blank';
    title.rel = 'noopener';
    title.textContent = work.title || work.display_name || 'Titre indisponible';
    main.appendChild(title);

    var meta = document.createElement('div');
    meta.className = 'oa-work-meta';
    var metaParts = [(work.publication_year || '?'), authorsHtml(work), '<span class="oa-work-journal">' + esc(state.journalTitle || '') + '</span>'];
    var langLabel = languageLabel(work.language);
    if(langLabel) metaParts.push(esc(langLabel));
    meta.innerHTML = metaParts.join(' · ');
    main.appendChild(meta);

    var subfield = work.primary_topic && work.primary_topic.subfield && work.primary_topic.subfield.display_name;
    if(subfield){
      var badge = document.createElement('span');
      badge.className = 'oa-work-subfield';
      badge.textContent = subfield;
      main.appendChild(badge);
    }

    var abstractText = invertedIndexToText(work.abstract_inverted_index);
    if(abstractText){
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'oa-work-abstract-toggle';
      toggle.innerHTML = '<span class="material-symbols-outlined">expand_more</span>Résumé';
      var abstractBox = document.createElement('div');
      abstractBox.className = 'oa-work-abstract';
      abstractBox.textContent = abstractText;
      toggle.addEventListener('click', function(){
        var open = abstractBox.classList.toggle('expanded');
        toggle.classList.toggle('expanded', open);
      });
      main.appendChild(toggle);
      main.appendChild(abstractBox);
    }

    item.appendChild(main);

    var actions = document.createElement('div');
    actions.className = 'oa-work-actions';

    var pdfUrl = bestPdfUrl(work);
    var pdf = document.createElement(pdfUrl ? 'a' : 'span');
    pdf.className = 'oa-work-pdf-btn' + (pdfUrl ? '' : ' disabled');
    if(pdfUrl){ pdf.href = pdfUrl; pdf.target = '_blank'; pdf.rel = 'noopener'; pdf.title = 'Télécharger le PDF'; }
    else { pdf.title = 'PDF non disponible'; }
    pdf.innerHTML = '<span class="material-symbols-outlined">picture_as_pdf</span>PDF';
    actions.appendChild(pdf);

    var htmlUrl = bestHtmlUrl(work, pdfUrl);
    if(htmlUrl){
      var htmlLink = document.createElement('a');
      htmlLink.className = 'oa-work-html-btn';
      htmlLink.href = htmlUrl;
      htmlLink.target = '_blank';
      htmlLink.rel = 'noopener';
      htmlLink.title = 'Voir en HTML';
      htmlLink.innerHTML = '<span class="material-symbols-outlined">description</span>HTML';
      actions.appendChild(htmlLink);
    }

    item.appendChild(actions);

    return item;
  }
```

- [ ] **Step 2: Vérifier textuellement les changements**

Run: `grep -n "invertedIndexToText\|bestHtmlUrl\|languageLabel\|oa-work-abstract-toggle\|primary_topic" "index.html"`

Expected: chaque terme apparaît (fonction définie + utilisée dans `renderWork`), et **aucune** occurrence de `oa-work-cited` ou `cited_by_count` ne doit rester dans ce script :

Run: `grep -n "oa-work-cited\|cited_by_count" "index.html"`

Expected: aucune ligne (0 résultat) — confirme que le compteur de citations a bien été retiré.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: enrich article list — abstract toggle, subfield badge, language, HTML link; remove citation count"
```

---

### Task 7: Vérification manuelle complète dans le navigateur

**Prérequis :** toutes les tâches 1 à 6 sont commitées.

- [ ] **Step 1: Ouvrir `index.html` dans le navigateur de preview**

Ouvrir le fichier directement (`file:///.../DOAJ/OA/index.html`) via l'outil de preview du navigateur, puisqu'il s'agit d'un fichier statique sans serveur de dev.

- [ ] **Step 2: Vérifier la réduction des titres**

Comparer visuellement le titre d'en-tête, les titres de section (ex: « Réseau d'indexation des revues ») et les titres de cartes de revue : ils doivent être nettement plus petits qu'avant, sans troncature ni superposition avec les éléments voisins (badge, icônes).

- [ ] **Step 3: Vérifier le plein écran du graphique d'indexation**

Cliquer sur le bouton « Plein écran » du graphique « Réseau d'indexation des revues » : le graphique doit occuper tout l'écran, le bouton doit passer en « Quitter plein écran », et le graphique ne doit pas apparaître déformé ou vide (le `resize` doit avoir été déclenché). Quitter le plein écran (Échap ou bouton) et vérifier le retour à la taille normale.

- [ ] **Step 4: Vérifier le mode sépia sur le popup**

Basculer le thème en mode sépia (bouton de thème dans l'en-tête). Ouvrir le popup articles d'une revue (bouton loupe sur une carte de revue). Vérifier que le fond du popup, le texte, les bordures et les liens utilisent bien la palette sépia (fond beige/crème, texte brun foncé) et non les couleurs du thème clair.

- [ ] **Step 5: Vérifier le contenu du popup articles**

Dans le popup ouvert :
- La carte source ne doit plus afficher que la ligne ISSN (plus de Type de source / Éditeur / Accès ouvert / Dans le DOAJ).
- Le titre de la revue en haut du popup doit être un lien cliquable vers sa fiche OpenAlex (nouvel onglet).
- Un graphique en courbe « Publications par an » doit apparaître sous la carte ISSN (si la revue a des données `counts_by_year`).
- Pour au moins un article de la liste :
  - Pas de nombre de citations affiché.
  - Un badge de sous-discipline (subfield) est visible si disponible.
  - La langue de l'article est affichée si disponible.
  - Un bouton « Résumé » est visible si un résumé existe ; cliquer dessus doit déplier le texte du résumé, re-cliquer doit le replier.
  - Le bouton PDF a un nouveau style au survol (fond dégradé, ombre, icône).
  - Si l'article a une page HTML éditeur distincte du PDF, un bouton « HTML » apparaît à côté du bouton PDF.

- [ ] **Step 6: Vérifier l'absence de régression en thème clair et sombre**

Rebasculer en thème clair puis sombre, rouvrir le popup, confirmer que les couleurs restent correctes dans ces deux modes (pas de régression introduite par le bloc `html.sepia{...}` ajouté à la Task 3).

- [ ] **Step 7: Vérifier la console navigateur**

Confirmer l'absence de nouvelles erreurs JavaScript dans la console liées aux changements (ex: `renderPubYearChart`, `ecInit`, `Intl.DisplayNames`).

Aucun commit à cette étape — c'est une vérification, pas une modification de code. Si un problème est détecté, revenir à la tâche concernée, corriger, re-vérifier, et commit le correctif séparément.
