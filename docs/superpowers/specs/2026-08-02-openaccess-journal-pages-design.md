# Design — Pages de revue dédiées (`/openaccess/{ISSN}`)

**Date :** 2026-08-02
**Statut :** Approuvé (relecture finale en cours)

---

## Objectif

Transformer le panneau « articles OpenAlex » actuel (`#oa-works-modal`, ouvert uniquement pour les revues indexées par OpenAlex) en une vraie page par revue, avec :

1. Une URL dédiée et automatique pour **toutes** les revues du catalogue : `https://africanjournals.azilan.me/openaccess/{ISSN ou eISSN}` — pas seulement celles indexées par OpenAlex.
2. Un bloc générique DOAJ **toujours affiché** (pays, éditeur, langues, licence, mots-clés, sujets, processus d'évaluation, délai de publication, frais de publication, préservation, identifiant pérenne, droit d'auteur, date d'ouverture en accès libre, nombre d'articles indexés + estimation dérivée, liens).
3. Le bloc OpenAlex existant (articles, graphiques, sujets IA) affiché **en plus**, seulement si la revue résout dans OpenAlex.
4. Quand une revue a un ISSN **et** un eISSN, les deux URLs doivent afficher le même contenu (pas de lien visible pour le second identifiant — il doit juste fonctionner si on le visite).

Décisions déjà validées avec l'utilisateur :
- Le catalogue reste visible en arrière-plan ; le contenu s'ouvre par-dessus comme le popup actuel, mais avec une vraie URL, un retour arrière navigateur fonctionnel, et un lien partageable.
- Les deux liens (ISSN/eISSN) n'ont pas besoin d'être affichés dans l'UI, juste de fonctionner tous les deux.
- Priorité d'affichage : eISSN si présent, sinon ISSN.
- Compromis accepté : sans rendu serveur, un bot d'aperçu de lien qui n'exécute pas de JS verra le titre générique du site, pas le nom de la revue précise.

---

## Architecture générale

Le site est un unique `index.html` statique, sans build ni rendu serveur, hébergé sur un serveur de type Apache (confirmé : `.htaccess` répond 403 en accès direct, donc pris en compte par le serveur ; aucune règle de réécriture actuelle sur `/openaccess/*`, qui renvoie un 404 Apache standard aujourd'hui).

Approche : **routage côté client** (History API), pas de génération de pages statiques par revue. Le panneau reste superposé au catalogue (`#oa-works-modal`), piloté par `history.pushState`/`popstate`, avec repli `.htaccess` pour que les visites directes ou rafraîchissements sur `/openaccess/...` chargent bien `index.html` au lieu d'un 404.

---

## 1. Génération automatique du lien (sur chaque carte, toutes revues)

Aujourd'hui, seul le bouton OpenAlex (`addOAButton`, `index.html:5948`) ouvre le panneau, et il n'existe que si `oaData.works_count` est vrai. Comme **toutes** les revues doivent avoir une page, le titre de la carte devient le déclencheur universel.

### `renderCards` / `renderBatch` (`index.html:5512-5516`)

```js
const eIdRaw = normIssnStr(eissn);
const pIdRaw = normIssnStr(issn);
const primaryId = eIdRaw || pIdRaw || null; // priorité eISSN, sinon ISSN

let titleEl;
if (primaryId) {
  titleEl = document.createElement('a');
  titleEl.href = '/openaccess/' + encodeURIComponent(primaryId);
  titleEl.className = 'card-title card-title-link';
  titleEl.addEventListener('click', function(e){
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // laisser le navigateur ouvrir un nouvel onglet
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

CSS (nouveau, à côté de `.oa-works-title-link` existant) :
```css
.card-title-link{ color:inherit; text-decoration:none; cursor:pointer; }
.card-title-link:hover{ color:var(--accent); text-decoration:underline; }
```

Cas limite : si une revue n'a ni ISSN ni eISSN valide (`primaryId` null), le titre reste un `<div>` simple, sans lien — comportement actuel inchangé.

### Bouton OpenAlex (`addOAButton`, `index.html:5948`) — même déclencheur

Le bouton OpenAlex doit ouvrir exactement la même page (pas un chemin séparé). Il faut lui passer la ligne `r` du tableau (actuellement seul `oaData` est transmis) :

- Call site `index.html:5702-5710` : `window._oaAddButton(card, oaData, r)` (ajout du 3ᵉ argument).
- `addOAButton(card, oaData, r)` : le `click` du bouton appelle `window._openJournalRoute(r, true)` au lieu de `window._oaOpenWorksModal(oaData, journalTitle)` directement. `oaData` n'est alors utilisé que pour afficher le badge (compteur, tooltip) — inchangé sur ce point.

---

## 2. Résolution ISSN ↔ eISSN ↔ ligne DOAJ

Fonctions ajoutées (dans le script de routage, nouveau bloc) :

```js
function normIssnStr(v){ /* déjà définie index.html:5380, réutilisée telle quelle */ }

function findRowByIssn(id){
  const norm = normIssnStr(id);
  if (!norm || typeof RAW === 'undefined' || !Array.isArray(RAW)) return null;
  for (const r of RAW) {
    if (normIssnStr(r[COLS.issn]) === norm || normIssnStr(r[COLS.eissn]) === norm) return r;
  }
  return null;
}

function primaryIdForRow(row){
  return normIssnStr(row[COLS.eissn]) || normIssnStr(row[COLS.issn]) || null;
}

function issnFromPath(pathname){
  const m = /^\/openaccess\/([^/]+)\/?$/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}
```

`findRowByIssn` matche indifféremment sur ISSN ou eISSN normalisés (`normIssnStr` : majuscules, tirets normalisés) : visiter l'URL ISSN ou l'URL eISSN d'une même revue renvoie donc systématiquement la même ligne `RAW`, donc le même contenu — c'est ce mécanisme qui satisfait l'exigence des « 2 liens différents renvoyant au même contenu », sans qu'aucun des deux ne soit affiché explicitement dans l'UI.

---

## 3. Contenu de la page — bloc générique DOAJ (toujours affiché)

Nouveau conteneur statique dans le markup du panneau (`index.html:6084`, juste après `.oa-works-head`, avant `.oa-charts-row`) :

```html
<div id="oa-journal-info" class="oa-journal-info"></div>
```

Rempli synchronement (aucun appel réseau, tout vient de la ligne `RAW` déjà chargée) par une fonction `renderJournalInfo(row)` qui ajoute une ligne label/valeur pour chaque champ **présent** (les champs vides/absents sont omis, pas affichés en blanc) :

| Libellé affiché | Source | Notes |
|---|---|---|
| Pays | `row[COLS.country]` | + drapeau (`countryFlagHtml`) |
| Éditeur | `row[COLS.publisher]` | *(nouveau — voir §6 Worker)* |
| Langues | `splitMulti(row[COLS.langs])` | liste jointe |
| Licence | `row[COLS.license]` + `row[COLS.licenseAttributes]` | *(attributs : nouveau — voir §6)* |
| Lien vers le texte de la licence | `row[COLS.licenseTermsUrl]` | *(nouveau — voir §6)*, affiché seulement si présent |
| Statut Diamant | badge Oui/Non (`isApcNoRow(row)`) | calcul réutilisé de `index.html:5455` — voir composant badge ci-dessous |
| Mots-clés | `makeKeywordChips(row)` | réutilise le composant existant tel quel |
| Sujets (classification DOAJ) | `row[COLS.subjects].split('\|')` | rendu en liste, un sujet par ligne |
| Processus d'évaluation | `row[COLS.reviewprocess]` + lien « En savoir plus » si `row[COLS.reviewProcessUrl]` présent | *(URL : nouveau — voir §6)* |
| Délai de publication | `row[COLS.weeks]` + « semaines » | |
| Frais de publication (APC) | `row[COLS.apc]` (Oui/Non) + montant/devise si Oui + lien « En savoir plus » si `row[COLS.apcInfoUrl]` présent | réutilise `parseApcAmount`/`toEur` (`index.html:5658-5659`) pour la conversion € déjà utilisée sur la carte ; *(URL : nouveau — voir §6)* |
| Services de préservation | `row[COLS.preservation]` + `row[COLS.preservationNL]` si présent | |
| Identifiant pérenne | `row[COLS.persistentIds]` | affiche « Aucun » si vide |
| Droit d'auteur | badge Oui/Non (`row[COLS.authorCopyright]`) | libellé : « L'auteur conserve ses droits sans restriction » — voir composant badge ci-dessous |
| Ouvert en accès libre depuis | `row[COLS.opensince]` | année |
| Articles indexés au DOAJ | `row[COLS.numArticles]` + estimation dérivée | voir formule ci-dessous |
| Liens | `row[COLS.url]` (site de la revue), `row[COLS.doajUrl]` (fiche DOAJ) | boutons/liens externes, `target="_blank"` |

### Composant badge Oui/Non

Demande explicite : « Author holds copyright without restrictions » doit être « affiché comme un bouton oui ou non », pas comme du texte brut. Un même petit composant pastille est réutilisé pour ce champ et pour le statut Diamant (cohérence visuelle entre les deux informations booléennes de la page) :

```js
function yesNoBadge(isYes){
  const span = document.createElement('span');
  span.className = 'oa-info-flag ' + (isYes ? 'oa-info-flag-yes' : 'oa-info-flag-no');
  span.textContent = isYes ? 'Oui' : 'Non';
  return span;
}
```

```css
.oa-info-flag{ display:inline-flex; align-items:center; padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700; }
.oa-info-flag-yes{ color:#15803d; background:rgba(34,197,94,.14); }
.oa-info-flag-no{ color:var(--muted); background:var(--chip-bg); }
```

`row[COLS.authorCopyright]` est une chaîne DOAJ (`"Yes"`/`"No"`) : `isYes = String(row[COLS.authorCopyright] || '').trim().toLowerCase() === 'yes'`.

### Estimation dérivée « articles / an »

```js
function estimateArticlesPerYear(row){
  const n = parseInt(row[COLS.numArticles], 10);
  if (!n || n <= 0) return null;
  let startYear = parseInt(row[COLS.opensince], 10);
  if (!startYear) {
    const d = row[COLS.addedon] && typeof parseFlexibleDate === 'function' ? parseFlexibleDate(row[COLS.addedon]) : null;
    startYear = d ? d.getFullYear() : null;
  }
  if (!startYear) return null;
  const years = Math.max(1, new Date().getFullYear() - startYear);
  return Math.round(n / years);
}
```

Affichage : `"{numArticles} articles indexés au DOAJ (~{estimate} articles/an, estimation)"` si l'estimation est calculable, sinon juste `"{numArticles} articles indexés au DOAJ"`. Le mot « estimation » reste toujours visible à côté du chiffre dérivé, pour ne jamais le présenter comme une donnée officielle.

---

## 4. Contenu de la page — bloc OpenAlex (conditionnel)

Le contenu existant du popup (graphiques, sujets IA, liste d'articles) est conservé **tel quel** dans ses fonctions (`openWorksModal`, `renderPubYearChart`, `renderAvailabilityGauge`, `loadPage`, `generateTopics`, etc. — aucune modification de leur logique interne). Seul le markup englobant change pour pouvoir masquer tout le bloc d'un coup :

```html
<div id="oa-openalex-section" style="display:none;">
  <div class="oa-charts-row">...</div>          <!-- existant, inchangé -->
  <div id="oa-topics-wrap" class="oa-topics-wrap">...</div>  <!-- existant, inchangé -->
  <div class="oa-works-body" id="oa-works-body"></div>       <!-- existant, inchangé -->
</div>
<div id="oa-openalex-absent-note" class="oa-openalex-absent-note" style="display:none;">
  Cette revue n'est pas (encore) indexée par OpenAlex.
</div>
```

### Orchestration : `openJournalPage(row)`

Nouvelle fonction, appelée par le routage (§5), qui remplace l'appel direct à `openWorksModal` :

```js
let pageToken = 0;

function openJournalPage(row){
  const myToken = ++pageToken;
  const modal = document.getElementById('oa-works-modal');
  const titleEl = document.getElementById('oa-works-title');
  const oaSection = document.getElementById('oa-openalex-section');
  const absentNote = document.getElementById('oa-openalex-absent-note');

  const title = row[COLS.title] || 'Revue sans titre';
  const doajUrl = row[COLS.doajUrl];
  titleEl.innerHTML = doajUrl
    ? '<a href="' + esc(doajUrl) + '" target="_blank" rel="noopener" class="oa-works-title-link">' + esc(title) + '</a>'
    : esc(title);

  renderJournalInfo(row); // bloc générique, §3 — synchrone

  oaSection.style.display = 'none';
  absentNote.style.display = 'none';

  modal.style.display = 'flex';
  document.title = title + ' · ' + SITE_TITLE;

  const eissn = row[COLS.eissn], issn = row[COLS.issn];
  if ((eissn || issn) && typeof window._oaFetch === 'function') {
    window._oaFetch(eissn, issn).then(function(oaData){
      if (myToken !== pageToken) return; // une autre revue a été ouverte entre-temps
      if (oaData && oaData.works_count) {
        oaSection.style.display = '';
        openWorksModal(oaData, title); // fonction existante, inchangée — remplit charts/topics/liste
      } else {
        absentNote.style.display = 'block';
      }
    });
  } else {
    absentNote.style.display = 'block';
  }
}
window._openJournalPage = openJournalPage;
```

`openWorksModal` n'est donc plus appelée directement par un clic, mais uniquement par `openJournalPage` une fois la résolution OpenAlex confirmée positive — sa logique interne (titre avec lien vers la source OpenAlex, graphiques, liste paginée, sujets IA) reste 100 % inchangée. Le token (`pageToken`, distinct du `state.token` interne déjà existant dans `openWorksModal`) évite qu'une résolution OpenAlex tardive d'une revue précédente n'écrase l'affichage d'une revue ouverte entre-temps.

### État « revue introuvable » (lien profond invalide)

```js
function openJournalPageNotFound(id){
  const modal = document.getElementById('oa-works-modal');
  document.getElementById('oa-works-title').textContent = 'Revue introuvable';
  document.getElementById('oa-journal-info').innerHTML =
    '<div class="oa-works-state">Aucune revue ne correspond à l\'identifiant ' + esc(id) + ' dans le catalogue.</div>';
  document.getElementById('oa-openalex-section').style.display = 'none';
  document.getElementById('oa-openalex-absent-note').style.display = 'none';
  modal.style.display = 'flex';
}
```

---

## 5. Routage : ouverture, liens profonds, retour

```js
const SITE_TITLE = document.title; // capturé une fois au chargement du script
const ROUTE = { active: false, pushed: false };

function openJournalRoute(row, pushUrl){
  const id = primaryIdForRow(row);
  if (!id) return;
  if (pushUrl) {
    history.pushState({ openaccess: id }, '', '/openaccess/' + encodeURIComponent(id));
    ROUTE.pushed = true;
  }
  ROUTE.active = true;
  openJournalPage(row);
}
window._openJournalRoute = openJournalRoute;

function closeJournalRoute(){
  if (!ROUTE.active) return;
  if (ROUTE.pushed) {
    history.back(); // déclenche popstate, qui fait le vrai travail de fermeture
  } else {
    history.replaceState(null, '', '/');
    finishClose();
  }
}

function finishClose(){
  ROUTE.active = false;
  ROUTE.pushed = false;
  closeModal(); // fonction existante index.html:6328, inchangée
  document.title = SITE_TITLE;
}

window.addEventListener('popstate', function(){
  const id = issnFromPath(location.pathname);
  if (id) {
    ROUTE.active = true;
    ROUTE.pushed = true;
    const row = findRowByIssn(id);
    if (row) openJournalPage(row); else openJournalPageNotFound(id);
  } else if (ROUTE.active) {
    finishClose();
  }
});
```

- Panneau ouvert depuis une carte (clic sur le titre ou le bouton OpenAlex) → `openJournalRoute(row, true)` → une entrée d'historique est ajoutée ; fermeture (croix, Échap, clic hors panneau) → `history.back()`, qui redonne la main au `popstate` pour fermer proprement.
- Panneau ouvert par arrivée directe sur `/openaccess/...` (pas d'entrée `/` avant dans l'historique de cet onglet) → fermeture = `replaceState('/')` + fermeture immédiate, **sans** `history.back()` (pour ne pas faire sortir l'utilisateur du site vers ce qu'il consultait avant, ex. un moteur de recherche).
- Les gestionnaires existants de fermeture (`index.html:6572-6580` : clic sur `#oa-works-close`/overlay, touche Échap) doivent appeler `closeJournalRoute()` au lieu de `closeModal()` directement.

### Chargement initial (arrivée directe sur `/openaccess/{id}`)

```js
function handleInitialRoute(){
  const id = issnFromPath(location.pathname);
  if (!id) return;
  ROUTE.active = true;
  ROUTE.pushed = false;

  // Affichage immédiat d'un état de chargement, sans attendre RAW
  document.getElementById('oa-works-modal').style.display = 'flex';
  document.getElementById('oa-works-title').textContent = 'Chargement…';
  document.getElementById('oa-journal-info').innerHTML = '<div class="oa-works-state">Chargement de la fiche…</div>';
  document.getElementById('oa-openalex-section').style.display = 'none';

  waitForRawThenRoute(id);
}

function waitForRawThenRoute(id){
  if (typeof RAW !== 'undefined' && Array.isArray(RAW) && RAW.length) {
    const row = findRowByIssn(id);
    if (row) openJournalPage(row); else openJournalPageNotFound(id);
    return;
  }
  setTimeout(function(){ waitForRawThenRoute(id); }, 350); // même pattern que waitForDataAndRefresh, index.html:5756
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleInitialRoute);
} else {
  handleInitialRoute();
}
```

Le catalogue continue de charger normalement en arrière-plan pendant que le panneau affiche son état de chargement puis son contenu — les deux ne sont pas séquentiels.

---

## 6. Worker : nouvelles colonnes DOAJ

`worker/worker.js`, `NEEDED_COLS` (`worker.js:50-75`) — 5 colonnes ajoutées (noms exacts du CSV DOAJ, vérifiés en récupérant l'export réel) :

```js
const NEEDED_COLS = [
  "Journal title",
  "ISSN",
  "EISSN",
  "Journal URL",
  "Languages in which the journal accepts manuscripts",
  "Journal license",
  "License attributes",              // nouveau
  "URL for license terms",           // nouveau
  "Country of publisher",
  "Country of other organisation",
  "Average number of weeks between article submission and publication",
  "DOI",
  "Subjects",
  "Keywords",
  "When did the journal start to publish all content using an open license?",
  "Added on Date",
  "Review process",
  "Review process information URL",  // nouveau
  "Most Recent Article Added",
  "URL in DOAJ",
  "Author holds copyright without restrictions",
  "APC",
  "APC information URL",             // nouveau
  "APC amount",
  "APC amount currency",
  "Preservation Services",
  "Preservation Service: national library",
  "Persistent article identifiers",
  "Publisher",                       // nouveau
];
```

`index.html`, `COLS` (`index.html:1684-1710`) — 5 clés ajoutées :

```js
const COLS = {
  ...
  publisher: "Publisher",
  licenseAttributes: "License attributes",
  licenseTermsUrl: "URL for license terms",
  reviewProcessUrl: "Review process information URL",
  apcInfoUrl: "APC information URL",
  ...
};
```

Tant que le worker n'est pas redéployé et son cache KV rafraîchi, ces 5 champs seront simplement absents des lignes `RAW` (`undefined`) — le code de rendu du bloc générique (§3) omet déjà silencieusement les champs vides, donc aucune erreur, juste ces lignes manquantes jusqu'au déploiement.

---

## 7. `.htaccess` — réécriture serveur

Nouveau fichier local `OA/.htaccess` (le dépôt local n'en contient pas ; le serveur en ligne en a un que je ne peux pas lire à distance — voir Déploiement) :

```apache
# --- Pages de revue OpenAccess (routage SPA côté client) ---
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^openaccess/ index.html [L]
```

---

## Fichiers modifiés

- `index.html` : lien de titre de carte, passage de `r` à `addOAButton`, nouveau markup `#oa-journal-info` / `#oa-openalex-section` / `#oa-openalex-absent-note`, fonctions de routage (`openJournalRoute`, `openJournalPage`, `findRowByIssn`, etc.), fonction de rendu du bloc générique, composant badge Oui/Non, 5 nouvelles clés `COLS`.
- `worker/worker.js` : 5 colonnes ajoutées à `NEEDED_COLS`.
- `OA/.htaccess` (nouveau fichier local, à fusionner manuellement sur le serveur).

## Déploiement

- **Worker** : nécessite `wrangler deploy` (depuis `worker/`) par l'utilisateur — pas d'accès à son compte Cloudflare depuis cette session. Le cache KV doit ensuite être rafraîchi (`/refresh?secret=...` ou attente du cron mensuel) pour que `Publisher`/`License attributes`/`URL for license terms`/`Review process information URL`/`APC information URL` apparaissent réellement dans `/csv`.
- **`.htaccess`** : le fichier généré est un extrait à **fusionner** dans le `.htaccess` existant du serveur (confirmé présent via le 403 en accès direct), pas à uploader en remplacement — cette session n'a pas accès au serveur pour vérifier son contenu actuel.
- **`index.html`** : upload manuel comme d'habitude (pas d'automatisation de déploiement détectée dans le dépôt).

## Hors scope

- Rendu côté serveur / balises meta par revue pour les aperçus de liens (bots sans JS) — compromis accepté par l'utilisateur.
- Affichage visible des 2 URLs (ISSN/eISSN) dans l'UI — les deux fonctionnent, aucune n'est montrée.
- Toute donnée DOAJ au-delà de la liste du §3 (ex. `Alternative title`, `Continues`/`Continued By`, `Subscribe to Open`, `LCC Codes`...) — non demandée, pas ajoutée.
- Modification de la logique Scopus/AJOL/Crossref existante sur les cartes — inchangée.
- Génération de pages HTML statiques réelles par revue (build step) — écarté au profit du routage client, cohérent avec l'absence de build actuel.
