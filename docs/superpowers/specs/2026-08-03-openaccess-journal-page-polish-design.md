# Polish des pages de revue autonomes — Design

**Date :** 2026-08-03
**Contexte :** Ce document couvre 7 ajustements demandés sur les pages `/openaccess/{id}` (livrées par le plan `docs/superpowers/plans/2026-08-02-openaccess-standalone-pages.md`). Il ne modifie rien côté catalogue (`/`) sauf le point 7, qui touche la fonction d'initialisation partagée.

**Fichier concerné :** `index.html` uniquement (mêmes conventions que le plan précédent : vanilla JS, pas de build, pas de framework de tests — vérification manuelle en navigateur).

---

## 1. Droit d'auteur — phrase au lieu du badge Oui/Non

**Où :** `renderJournalInfo(row)`, ligne `addInfoRow(container, 'Droit d\'auteur', yesNoBadge(...))`.

**Changement :** remplace le badge coloré `.oa-info-flag` par une phrase en texte simple (`.oa-info-value` standard, comme les autres lignes) :
- Si `row[COLS.authorCopyright]` vaut `"yes"` (insensible à la casse) : *« L'auteur conserve les droits d'auteur »*
- Sinon : *« L'auteur cède ses droits d'auteur à l'éditeur »*

Aucune autre ligne de `renderJournalInfo` n'est affectée. `yesNoBadge()` reste utilisé tel quel pour "Statut Diamant" (non concerné par cette demande).

---

## 2. Icône de lien externe sur le bloc d'infos générales

**Où :** `externalLink(url, label)` (helper partagé, ligne ~6570).

**Changement :** le helper ajoute systématiquement l'icône Material Symbols `open_in_new` après le texte du lien (police déjà chargée globalement, aucun changement de `<head>` nécessaire) :

```js
function externalLink(url, label){
  var a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  a.innerHTML = esc(label || 'En savoir plus') + ' <span class="material-symbols-outlined" style="font-size:13px;vertical-align:-2px;">open_in_new</span>';
  return a;
}
```

**Portée confirmée :** `externalLink()` n'est appelé que depuis `renderJournalInfo` (5 call sites : Texte de la licence, Processus d'évaluation, Frais APC, Site de la revue, Fiche DOAJ) — modifier le helper couvre exactement le périmètre demandé sans logique de portée supplémentaire. Les liens de la liste d'articles OpenAlex (titres, auteurs, PDF/HTML) ne sont pas concernés — ils ont déjà leurs propres icônes contextuelles (`picture_as_pdf`, `description`) ou n'en ont pas par convention établie.

---

## 3. Suppression de la mention "non indexée"

**Où :** markup `#oa-openalex-absent-note` (dans `#oa-journal-page`), sa règle CSS dans `#openaccess-journal-page-css`, et les 3 lignes JS qui la pilotent (`openJournalPage`, `openJournalPageNotFound`, et le reset dans `handleInitialRoute`).

**Changement :** suppression complète des trois (markup, CSS, JS) — pas de remplacement, pas de div vide. Quand une revue n'a pas de données OpenAlex, `#oa-openalex-section` reste simplement caché (`display:none`, déjà le comportement actuel) et rien d'autre ne s'affiche à sa place.

---

## 4. Tous les mots-clés affichés sur la page revue

**Où :** `renderJournalInfo(row)`, ligne qui appelle `window.makeKeywordChips(row)`.

**Changement :** nouvelle fonction locale à cette IIFE (pas exportée sur `window`, usage interne uniquement) :

```js
function makeAllKeywordChipsPlain(row){
  var keywords = typeof window.keywordListFromRow === 'function' ? window.keywordListFromRow(row) : [];
  var wrap = document.createElement('div');
  wrap.className = 'kw-wrap';
  keywords.forEach(function(kw){
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.cssText = 'font-size:11px;padding:3px 8px;';
    chip.textContent = kw;
    wrap.appendChild(chip);
  });
  return wrap;
}
```

`renderJournalInfo` appelle cette fonction à la place de `window.makeKeywordChips(row)`. Contrairement à la version carte du catalogue (max 3 puces + "Autre" cliquable qui filtre le catalogue), celle-ci affiche toutes les puces, sans troncature, sans clic — cohérent avec une page où le catalogue est masqué et où le filtrage n'a pas de sens. La classe CSS `.chip` (déjà stylée ailleurs) est réutilisée telle quelle pour la cohérence visuelle.

---

## 5. Espacement entre les graphiques et le bouton "Découvrir les sujets"

**Où :** CSS de `.oa-topics-wrap` dans `#openaccess-journal-page-css` (actuellement `margin:0 0 16px;`).

**Changement :** ajoute une marge supérieure : `margin:18px 0 16px;`. Comme le point 6 introduit une rangée à deux graphiques juste au-dessus (voir ci-dessous), c'est cette marge sur `.oa-topics-wrap` qui crée la séparation visuelle, plutôt qu'une marge sur le conteneur des graphiques (rend l'espacement correct que le journal soit indexé OpenAlex avec 0, 1 ou 2 graphiques visibles).

---

## 6. Nouveau graphique : langues de publication (OpenAlex)

### Emplacement et disposition

Réintroduction d'une rangée flexible (comme l'ancienne `.oa-charts-row`, sans jauge de disponibilité) contenant `#oa-pubyear-chart-wrap` et un nouveau `#oa-lang-chart-wrap`, côte à côte :

```html
<div class="oa-charts-row" id="oa-charts-row">
  <div id="oa-pubyear-chart-wrap" class="oa-pubyear-chart-wrap">
    <div class="oa-pubyear-chart-title">Publications par an</div>
    <div id="oa-pubyear-chart" style="height:220px;"></div>
  </div>
  <div id="oa-lang-chart-wrap" class="oa-pubyear-chart-wrap" style="display:none;">
    <div class="oa-pubyear-chart-title">Langues de publication</div>
    <div id="oa-lang-chart" style="height:220px;"></div>
  </div>
</div>
```

(`#oa-lang-chart-wrap` réutilise la classe `.oa-pubyear-chart-title`/le style de `.oa-pubyear-chart-wrap` pour la cohérence visuelle — pas de nouvelle classe CSS nécessaire à part `.oa-charts-row`, réintroduite avec les mêmes règles `display:flex; gap:12px;` + media query mobile `flex-direction:column` qu'avant sa suppression dans le plan précédent, moins tout ce qui concernait la jauge.)

La hauteur des deux graphiques passe de 150px (actuel `#oa-pubyear-chart`) à 220px pour laisser de la place aux étiquettes et à la légende du camembert — ajustée pour les deux graphiques afin qu'ils restent alignés en hauteur côte à côte.

### Style visuel du graphique

Même type que "Processus d'évaluation" (`updateReviewProcess`, ligne ~2332) : camembert "rose" (nightingale), sans le comportement de clic-filtre (non pertinent ici, une seule revue) :

```js
function renderLangChart(langGroups){
  var wrap = document.getElementById('oa-lang-chart-wrap');
  if(!wrap) return;
  if(!langGroups || !langGroups.length){ wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  var chart = ecInit('oa-lang-chart');
  if(!chart) return;
  chart.setOption({
    tooltip: { trigger:'item', formatter:'{b}: {c} publication{c1}s ({d}%)' },
    legend: { bottom: 2, left:'center', type:'scroll', textStyle:{ fontSize:11 }, itemGap:6 },
    series: [{
      type: 'pie',
      radius: ['18%', '72%'],
      center: ['50%', '46%'],
      roseType: 'area',
      itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 1 },
      label: { show: true, fontSize: 10, formatter: '{b}\n{d}%' },
      labelLine: { length: 8, length2: 6 },
      data: langGroups.map(function(g){ return { name: g.label, value: g.count }; })
    }]
  });
}
```

(Le formatter du tooltip avec `{c1}` n'est pas une syntaxe ECharts valide — sera simplifié en implémentation, ex. `'{b}: {c} publications ({d}%)'`, cohérent avec le tooltip existant de "Processus d'évaluation".)

### Source des données

Nouvelle fonction, appelée depuis `openWorksModal` en parallèle du chargement existant (pubyear/works) :

```js
function loadLangDistribution(sourceId, myToken){
  var wrap = document.getElementById('oa-lang-chart-wrap');
  if(wrap) wrap.style.display = 'none';
  fetch('https://api.openalex.org/works?filter=primary_location.source.id:' + encodeURIComponent(sourceId) + '&group_by=language')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){
      if(myToken !== state.token || !d || !d.group_by) return;
      var groups = d.group_by
        .filter(function(g){ return g.key && g.count; })
        .map(function(g){ return { label: languageLabel(g.key) || g.key_display_name || g.key, count: g.count }; })
        .sort(function(a,b){ return b.count - a.count; });
      var TOP = 6;
      var top = groups.slice(0, TOP);
      var restCount = groups.slice(TOP).reduce(function(sum,g){ return sum + g.count; }, 0);
      if(restCount) top.push({ label: 'Autres', count: restCount });
      renderLangChart(top);
    })
    .catch(function(){});
}
```

Appel ajouté dans `openWorksModal`, juste après la ligne existante `if(pubyearWrap) pubyearWrap.style.display = 'none';` :

```js
var langWrap = document.getElementById('oa-lang-chart-wrap');
if(langWrap) langWrap.style.display = 'none';
loadLangDistribution(state.sourceId, state.token);
```

Utilise le paramètre OpenAlex `group_by=language`, qui retourne un agrégat exact sur **tous** les articles de la revue en un seul appel (pas de pagination, pas de dépendance à ce qui est déjà chargé dans la liste d'articles). Suit le même pattern de staleness-check (`myToken !== state.token`) que `loadSourceCard`/l'ancien `loadAvailability`.

---

## 7. Chargement plus rapide des pages individuelles

### Diagnostic

`initWithData(rowsRaw)` (script principal du catalogue) exécute, sans condition, toute la construction du catalogue — `renderAllCards()` (881 cartes DOM), `updateAllViz(RAW)` (cartes, graphiques, nuage de mots), les dropdowns de filtres, et surtout le fan-out d'enrichissement par carte (une requête Crossref + une requête OpenAlex par revue, ~1700+ requêtes réseau) — **même quand la page affichée est `/openaccess/{id}`**, où le catalogue reste `display:none` et n'est jamais vu. C'est la cause directe de la lenteur observée (confirmée dans les logs de test manuel du plan précédent : dizaines d'échecs Crossref visibles même sur une page revue).

### Changement

Après `RAW = filtered;` dans `initWithData`, on distingue la route :

```js
function initWithData(rowsRaw){
  const rows = normalizeHeaders(rowsRaw).filter(r=>Object.keys(r).length);
  const headers = Object.keys(rows[0] || {}).map(cleanHeader);
  remapIfNeeded(headers);

  const filtered = rows
    .filter(r => isAfricanRow(r))
    .map(r=>{ /* ... inchangé ... */ });

  RAW = filtered;

  if (typeof window._issnFromPath === 'function' && window._issnFromPath(location.pathname)) {
    // Page revue autonome : le catalogue (cartes, dropdowns, visualisations,
    // enrichissement par carte) est masqué et inutilisé sur cette route — on
    // ne construit que ce dont openJournalPage a besoin (RAW, déjà en place).
    _enrichmentCachePromise.then(function(enrichData){
      if(enrichData) _applyEnrichmentCache(enrichData); // pré-résout potentiellement CETTE revue sans requête supplémentaire
      document.getElementById("csv-modal").style.display = "none";
      clearInterval(window._loadingInterval);
      const ov = document.getElementById("loading-overlay");
      if(ov){ ov.classList.add("hidden"); setTimeout(()=>ov.remove(), 400); }
    });
    return;
  }

  updateTotalCount();
  buildLangDropdown(RAW.map(r=>r[COLS.langs]));
  buildDropdownOptional("q-license", RAW.map(r=>r[COLS.license]));
  buildDisciplineKeywordDropdown(RAW);
  computeWeeksRange();
  if(FX_RATES !== null){
    if(typeof window.initApcViz === 'function') window.initApcViz(RAW);
  } else {
    window._apcVizPending = true;
  }

  _enrichmentCachePromise.then(function(enrichData){
    /* ... bloc existant inchangé (renderCards, renderAllCards, updateAllViz,
       fermeture overlay, rapports Crossref/OpenAlex à 15s/22s) ... */
  });
}
```

**Nouvel export cross-IIFE requis :** `issnFromPath` est actuellement défini dans le second `<script>` (IIFE OpenAlex/routing), pas accessible depuis le script principal. Ajout de `window._issnFromPath = issnFromPath;` juste après sa définition (même pattern déjà utilisé pour `normIssnStr`, `keywordListFromRow`, `makeKeywordChips` dans le plan précédent). Aucune duplication de la regex de parsing d'URL.

**Ce qui continue de fonctionner sans changement sur une page revue :**
- `window._oaFetch` (résolution OpenAlex par ISSN) : cache et fetch propres, indépendants du pipeline catalogue.
- Conversion APC en euros (`toEur`/`FX_RATES`) : chargé par son propre fetch, indépendant de `initWithData`.
- La fermeture de l'overlay de chargement et de la modale d'erreur CSV : toujours exécutée (juste sans le travail catalogue en plus).

**Ce qui est sauté sur une page revue (et reconstruit normalement au retour sur `/`, qui est une vraie navigation de page) :** rendu des 881 cartes, dropdowns de filtres, toutes les visualisations du catalogue (carte, nuage de mots, etc.), et les ~1700+ requêtes Crossref/OpenAlex d'enrichissement par carte + leurs rapports différés (15s/22s) au worker.

---

## Auto-revue de la spec

- **Balayage placeholders :** aucun TBD/TODO ; le formatter ECharts invalide du point 6 est explicitement corrigé dans le texte lui-même plutôt que laissé comme faute silencieuse.
- **Cohérence interne :** le point 5 (espacement) est explicitement rattaché à la nouvelle rangée à deux graphiques du point 6 plutôt que traité indépendamment, pour éviter un espacement incohérent selon le nombre de graphiques visibles.
- **Portée :** ce document ne couvre que `index.html` ; `worker/worker.js`, `.htaccess`, `vercel.json` non concernés (aucune de ces 7 demandes ne touche les données servies par le worker ni le routing serveur).
- **Ambiguïté :** toutes les questions ouvertes identifiées pendant l'exploration (téléchargement de la formulation "Non" du droit d'auteur, portée des icônes de lien, interactivité des mots-clés, disposition et type du graphique de langues) ont été tranchées avec l'utilisateur avant rédaction.
