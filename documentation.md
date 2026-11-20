# Documentation technique — Observatoire des revues africaines en libre accès

**Version** V4.1 · **Auteur** Innocent Azilan · **Licence** [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) · **Mise à jour** novembre 2026

> Révision de novembre 2026 : sections 3.5, 6.8, 7, 9 et 10, pour la compatibilité
> OAI-PMH et les outils bibliographiques. Les sections 1, 2, 4, 5, 6.1 à 6.7, 8, 11
> et 12 décrivent encore l'état de juin 2026 et n'ont pas été revues : la fiche
> revue autonome, le cache d'enrichissement et les résumés Workers AI, arrivés
> entre-temps, n'y figurent pas.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Structure des fichiers](#2-structure-des-fichiers)
3. [Architecture des données](#3-architecture-des-données)
   - 3.1 [DOAJ via Cloudflare Worker](#31-source-principale--doaj-via-cloudflare-worker)
   - 3.2 [Séquence de chargement](#32-séquence-de-chargement-startload)
   - 3.3 [Données AJOL](#33-données-ajol)
   - 3.4 [APIs tierces](#34-apis-tierces--enrichissement-à-la-demande)
   - 3.5 [Compatibilité OAI-PMH](#35-compatibilité-oai-pmh)
4. [Colonnes de données](#4-colonnes-de-données)
5. [Architecture CSS](#5-architecture-css)
6. [Sections de l'interface](#6-sections-de-linterface)
   - 6.1 [En-tête](#61-en-tête-header)
   - 6.2 [KPIs](#62-kpis-section-kpis)
   - 6.3 [Revues récentes](#63-revues-récentes-section-top10)
   - 6.4 [Recommandateur](#64-recommandateur-section-reco)
   - 6.5 [Visualisations](#65-visualisations-section-viz)
   - 6.6 [Catalogue](#66-catalogue-section-list)
   - 6.7 [Formulaire de feedback](#67-formulaire-de-feedback-section-report)
   - 6.8 [Fiche revue — citer et exporter](#68-fiche-revue--citer-et-exporter)
7. [Système de filtrage global](#7-système-de-filtrage-global)
8. [Dépendances front-end](#8-dépendances-front-end)
9. [Cloudflare Worker — Détails](#9-cloudflare-worker--détails-dimplémentation)
10. [Déploiement](#10-déploiement)
11. [Résilience du chargement](#11-résilience-du-chargement)
12. [Points d'attention](#12-points-dattention)

---

## 1. Vue d'ensemble

Application web **monofichier** (`index.html`) à rendu 100 % côté client (SPA sans framework). Elle consomme les métadonnées de revues africaines en libre accès issues du DOAJ, les enrichit via des APIs tierces, et les présente dans un tableau de bord interactif : KPIs, visualisations, catalogue filtrable et moteur de recommandation.

```
┌───────────────────────────────────────────────────────────────────┐
│  Navigateur (index.html — SPA 100% client-side)                   │
│  ├── Données principales ──► Cloudflare Worker (cache KV JSON)    │
│  ├── Cache local          ──► Cache API (CacheStorage, 31 jours)  │
│  ├── Enrichissement live  ──► Crossref API / OpenAlex API         │
│  ├── Cartographie         ──► Leaflet + Jawg Maps / OpenStreetMap │
│  ├── Taux de change       ──► Open Exchange Rates API             │
│  └── Index AJOL           ──► ajol_journals.csv (chargé en local) │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Structure des fichiers

```
OA/
├── index1.html                   # Application complète (HTML + CSS + JS inline)
│                                 #   sert la racine via serve.json
├── index.html                    # Ancien nom du même fichier, retiré
├── index - Copie.html            # Sauvegarde d'une version antérieure
├── test_biblio.js                # Vérification des formats de citation
│                                 #   node test_biblio.js
├── ajol_journals.csv             # Index AJOL (African Journals OnLine)
├── apc_african_journals.csv      # APC des revues africaines (devises d'origine)
├── apc_african_journals_eur.csv  # APC convertis en euros
└── worker/
    ├── worker.js                 # Cloudflare Worker — cache DOAJ
    └── wrangler.toml             # Configuration de déploiement Wrangler
```

---

## 3. Architecture des données

### 3.1 Source principale — DOAJ via Cloudflare Worker

Le Worker (`worker/worker.js`) est un proxy-cache : il ne sert jamais le CSV brut du DOAJ au client.

**Flux de données :**

```
DOAJ CSV (doaj.org/csv/journals)
         │
         ▼
Cloudflare Worker (worker.js)
  ├── Parse CSV maison RFC 4180 (sans dépendance externe)
  ├── Filtre : 54 pays africains (Set AFRICAN_COUNTRIES)
  ├── Conserve 21 colonnes (NEEDED_COLS)
  └── Stocke JSON compact dans KV (TTL 30 jours)
         │
         ▼
GET https://shiny-dew-f169.ynnonazaline.workers.dev/csv
         │
         ▼
index.html : fetch() avec timeout 90 s
         │
         ├── Réponse JSON valide ──► Cache API (CacheStorage, 31 jours) + initWithData()
         └── Réponse CSV         ──► PapaParse → initWithData()
```

**Endpoints du Worker :**

| Route | Méthode | Description |
|---|---|---|
| `/csv` ou `/` | GET | Retourne le JSON filtré depuis KV. Si KV vide : lance le rebuild en arrière-plan et retourne 503 immédiatement |
| `/status` | GET | Métadonnées du cache (`cachedAt`, `count`, `totalRows`) |
| `/refresh?secret=XXX` | GET | Rafraîchissement manuel protégé par secret |

**Cache côté client (`caches.open()`) :**

| Nom du cache | Clé | Contenu |
|---|---|---|
| `doaj-journal-json-cache-v2` | `"json"` | Tableau JSON des revues africaines |
| `doaj-journal-json-cache-ts-v2` | `"ts"` | Timestamp de la dernière récupération |
| `doaj-journal-json-cache-ts-v2` | `"cacheloaddate"` | Date lisible affichée dans l'en-tête |

> **Important :** Le cache utilise la **Cache API** (`caches.open()`), pas `localStorage`. Il est disponible sur les origines `http://localhost`, `https://` et certaines configurations `file://` selon le navigateur.

Durée de validité : 31 jours (`ONE_MONTH_MS`). Au-delà, un nouveau `fetch()` est déclenché automatiquement vers le Worker.

### 3.2 Séquence de chargement (`startLoad`)

```
loadAJOL()                    — fetch local ./ajol_journals.csv
    │
    ▼
tryFetchCSV()
    ├── CacheStorage valide ? ──► initWithData(data) → return true
    └── sinon → fetch Worker (AbortController, timeout 90 s)
                  ├── 200 + JSON ──► cache.put() + initWithData(data) → return true
                  ├── 200 + CSV  ──► parseCSV() → Papa.parse → initWithData(rows) → return true
                  ├── !resp.ok   ──► throw → return false
                  └── AbortError ──► return false

si return false :
    → clearInterval(_loadingInterval)
    → masquer #loading-overlay
    → afficher #csv-modal (Réessayer / Télécharger CSV / Upload manuel)
```

### 3.3 Données AJOL

`ajol_journals.csv` est parsé via PapaParse au démarrage et chargé dans `AJOL_MAP` : une `Map` `(eissn|issn en majuscules) → url_source_ajol`. Utilisé pour afficher le badge AJOL sur les cartes et activer le filtre « AJOL only ».

### 3.4 APIs tierces — enrichissement à la demande

| API | Usage | Déclencheur |
|---|---|---|
| **Crossref** `api.crossref.org` | Statut d'indexation, nombre d'articles, date du plus récent article | Chargement par lot, throttled |
| **OpenAlex** `api.openalex.org` | Données complémentaires sur les journaux | Enrichissement |
| **Open Exchange Rates** `open.er-api.com` | Taux de change pour conversion APC → euros | Prefetch IIFE au démarrage |
| **Jawg Maps** + **OpenStreetMap** | Tuiles cartographiques | Initialisation Leaflet |

### 3.5 Compatibilité OAI-PMH

Une revue est dite compatible OAI-PMH quand sa plateforme expose un entrepôt
moissonnable, c'est-à-dire quand une requête `?verb=Identify` y renvoie un XML
contenant `<Identify>` et `OAI-PMH`. Le DOAJ ne publie pas cette information : il
faut la sonder.

**Pourquoi pas validator.oaipmh.com.** Le validateur de référence n'a pas d'API
publique gratuite ; sa « REST API » est payante et s'obtient sur demande auprès de
l'auteur. La sonde est donc faite dans le Worker, avec le seul verbe `Identify`.

**URL candidates**, déduites de `Journal URL` et essayées dans cet ordre, la
première qui répond gagne :

| # | Motif | Plateforme visée |
|---|---|---|
| 1 | `<url>/oai` | OJS, URL déjà sur la revue |
| 2 | `<base OJS>/oai` | OJS, URL pointant une page profonde |
| 3 | `<url>/oai/request` | DSpace, EPrints |
| 4 | `<racine>/index.php/index/oai` | OJS, portail multi-revues |
| 5 | `<racine>/oai` | divers |
| 6 | `<racine>/oai/request` | divers |

Mesuré sur 60 revues tirées au sort du corpus : **23 exposent un entrepôt
détectable**, soit 38 %. Les plateformes Egyptian Knowledge Bank
(`journals.ekb.eg`) ressortent négatives ; si leur motif d'URL est identifié, il
suffit de l'ajouter à `oaiCandidates()`.

**Côté client.** `/enrichment` renvoie un objet `oai` que `_applyEnrichmentCache()`
dépose dans `window.OAI_MAP`, indexé par ISSN et par eISSN normalisés :

```js
window.OAI_MAP['2079-2883']
// { url: "http://akroterion.journals.ac.za/index.php/index/oai",
//   name: "Akroterion",
//   granularity: "YYYY-MM-DDThh:mm:ssZ",
//   earliest: "2012-03-30T08:59:48Z" }
```

Trois états, et non deux : un objet pour un entrepôt trouvé, `false` pour une revue
sondée sans résultat, et l'absence de clé pour une revue pas encore sondée. Le
filtre s'appuie sur cette distinction (voir section 7).

`window.oaiOf(issn, eissn)` renvoie la fiche ou `null`. La carte « Liens » de la
fiche revue en tire un lien **Entrepôt OAI-PMH** vers `<url>?verb=Identify`, avec
le nom du dépôt en infobulle.

---

## 4. Colonnes de données

La constante `COLS` dans le JS mappe des alias courts aux noms exacts des colonnes DOAJ :

| Alias JS | Colonne DOAJ |
|---|---|
| `title` | Journal title |
| `issn` / `eissn` | ISSN / EISSN |
| `url` | Journal URL |
| `langs` | Languages in which the journal accepts manuscripts |
| `license` | Journal license |
| `country` | Country of publisher |
| `countryOtherOrg` | Country of other organisation |
| `weeks` | Average number of weeks between article submission and publication |
| `doi` | DOI |
| `subjects` / `keywords` | Subjects / Keywords |
| `opensince` | When did the journal start to publish all content using an open license? |
| `addedon` | Added on Date |
| `reviewprocess` | Review process |
| `mostRecent` | Most Recent Article Added |
| `doajUrl` | URL in DOAJ |
| `authorCopyright` | Author holds copyright without restrictions |
| `apc` / `apcAmount` / `apcCurrency` | APC / APC amount / APC amount currency |
| `preservation` | Preservation Services |
| `preservationNL` | Preservation Service: national library |
| `persistentIds` | Persistent article identifiers |

---

## 5. Architecture CSS

Le bloc `<style>` est organisé en **couches successives**, chaque couche écrasant la précédente via `!important` :

| Ordre | Couche | Description |
|---|---|---|
| 1 | **Tokens de base** | Variables CSS (`:root`) : couleurs, ombres, flou — modes clair, dark, sépia |
| 2 | **Composants** | `.glass`, `.card`, `.btn`, `.badge`, `.chip`, `.modal`, etc. |
| 3 | **Fonctionnalités** | Carte fullscreen, barre de filtre actif, toolbar recherche, dots d'activité |
| 4 | **Linear dark overhaul** | Réécrit entièrement les tokens via `!important` pour imposer le thème sombre façon Linear (`#07090d`, accent `#69a8ff`) |
| 5 | **Linear pro pass** | Grille héro, hiérarchie typographique, espacement, grille de fond animée (`html::before`) |
| 6 | **Responsive 980px** | Ajustements tablette : topbar verticale, hauteurs des graphiques, espacement |
| 7 | **Responsive 700px** | Ajustements mobile : grilles à 1 colonne, toolbar empilée, tailles de police réduites |

> **Note :** La couche 4 (Linear dark overhaul) utilise des `!important` globaux qui neutralisent les classes `.dark` et `.sepia` en pratique. Le rendu est figé sur le thème Linear dark pour tous les utilisateurs.

---

## 6. Sections de l'interface

Chaque section est un `<section class="glass panel section-shell">` avec un `id` dédié.

### 6.1 En-tête (`<header>`)

- Logo animé (`.brand-dot` — pulse vert)
- Titre + sous-titre (`.brand-stack`)
- Navigation mini (`#mini-nav`) : liens vers les 5 sections
- Bouton toggle thème (`#toggle-theme`) — détection automatique `prefers-color-scheme`
- Bouton reset (`#btn-hard-reset`) — `location.reload()`

### 6.2 KPIs (`#section-kpis`)

Métriques calculées dynamiquement sur le tableau `RAW` à chaque chargement :

- Nombre total de revues
- Pays représentés
- Langues de publication
- Revues Diamond OA (sans APC)
- Revues avec APC
- Date de dernière mise à jour du cache Worker

### 6.3 Revues récentes (`#section-top10`)

Tableau des 10 derniers articles indexés (tri descendant sur `mostRecent`). Chaque entrée comporte un **point d'activité coloré et animé** :

| Couleur | Ancienneté du dernier article |
|---|---|
| 🟢 Vert | ≤ 52 semaines |
| 🟡 Jaune | 53 – 104 semaines |
| 🟠 Orange | 105 – 208 semaines |
| 🔴 Rouge | > 208 semaines |

### 6.4 Recommandateur (`#section-reco`)

Moteur de filtrage multi-critères pour orienter un chercheur vers la revue adaptée.

**Critères disponibles :**

| Critère | Composant |
|---|---|
| Pays de l'éditeur | `<select>` |
| Langue(s) acceptée(s) | Chips multi-sélection |
| Licence Creative Commons | `<select>` |
| Discipline / mots-clés | Input avec autocomplétion (jusqu'à 5 termes) |
| Délai soumission → publication | Range slider double avec histogramme en temps réel |
| DOI obligatoire | Toggle switch |
| Conservation des droits d'auteur | Toggle switch |
| Sans APC | Toggle switch |

**Export des résultats :** Markdown (texte brut) ou PDF (via jsPDF).

### 6.5 Visualisations (`#section-viz`)

Tous les graphiques ECharts partagent un **toolbox commun** accessible via l'icône en haut à droite : export PNG (pixel ratio ×2 pour l'impression) et export CSV des données brutes du graphique. Sauf exception mentionnée, un clic sur n'importe quel élément positionne `CURRENTFILTER` et filtre instantanément le catalogue.

**Tableau de synthèse :**

| ID | Type | Données | Filtre au clic |
|---|---|---|---|
| `viz-map` | Carte Leaflet — bulles | Nombre de revues par pays | `{type:'country'}` |
| `viz-added` | Scatter punch card | Revues ajoutées au DOAJ (mois × année) | `{type:'addedmonth'}` |
| `viz-tags` | Nuage de mots D3 | Top 120 mots-clés (`keywords`) | `{type:'tag'}` |
| `viz-langs` | Barres verticales ECharts | Top 30 langues d'acceptation | `{type:'lang'}` |
| `viz-lang-mono-multi` | Donut ECharts | Mono- vs multilingues | `{type:'monolingual'}` |
| `viz-license` | Donut ECharts | Répartition des licences | `{type:'license'}` |
| `viz-open-since` | Barres verticales ECharts | Année de passage en OA | `{type:'opensince'}` |
| `viz-review-process` | Rose chart Nightingale ECharts | Top 14 processus d'évaluation | `{type:'review'}` |
| `viz-apc-ratio` | Donut ECharts | Avec / sans frais de publication | `APC_FILTER_VAL` |
| `viz-apc-country` | Boxplot horizontal ECharts | Distribution APC en € par pays | — |
| `viz-weeks` | Histogramme ECharts | Distribution des délais publication | — |
| `viz-preservation` | Donut ECharts | Top 14 services de préservation | `{type:'preservation'}` |
| `viz-persistent-ids` | Barres HTML custom | Taux et types d'identifiants pérennes | — |
| `viz-subjects` | Barres verticales ECharts (vert) | Top 40 mots-clés normalisés (≥ 5 occ.) | `{type:'tag'}` |

#### `viz-map` — Carte choroplèthe par bulles

**Choix de représentation :** Cercles proportionnels plutôt qu'un choroplèthe coloré — les aplats de couleur sur des polygones pays biaiseraient la lecture (les grands pays seraient surreprésentés visuellement) ; les bulles quantifient directement sans dépendre de la surface.

**Construction :**
- Fond de carte : Jawg Maps (tuiles dark) + OpenStreetMap en fallback, limité aux limites de l'Afrique (`AFRICABOUNDS`, `maxBoundsViscosity: 1.0`, `minZoom: 2`).
- Bulles centrées sur des **centroïdes pays codés en dur** (`CENTROIDS`).
- **Taille** : échelle en racine carrée (`√(v / maxCount)`), interpolée entre 6 px (min) et 26 px (max).
- **Style** : remplissage bleu `#2563eb`, opacité 0,9, bordure blanche de 1 px.

**Interaction :** Survol → tooltip `Pays · N revues`. Clic → filtre `{type:'country', value:'Nigeria'}`. Bouton plein écran (`requestFullscreen`) dans la barre d'action sous la carte.

#### `viz-added` — Punch card des ajouts mensuels

Scatter plot en grille *mois × années* : repère à la fois les **tendances annuelles** (axe Y) et les **rythmes saisonniers** (axe X).

**Construction :**
- **Taille des points** : `max(8, count / maxCount × 44)`.
- **Couleur** : année la plus récente en ambre (`rgba(250,204,21, …)`) ; années précédentes en bleu avec opacité proportionnelle à l'intensité.

**Interaction :** Survol → tooltip listant les 5 premiers titres ajoutés ce mois-là. Clic → filtre `{type:'addedmonth', value:'2024-03'}`.

#### `viz-tags` — Nuage de mots-clés

**Construction :**
- **Source :** colonne `keywords`, fragmentée par `, ; |`, mise en minuscules. Top 120 termes.
- **Taille :** `d3.scaleSqrt()` de 10 à 42 px.
- **Couleur :** `d3.scaleLinear()` de `#dbeafe` (bleu très pâle) à `#1e3a8a` (bleu foncé).
- **Rotation :** fixée à 0° pour maximiser la lisibilité.

> **Différence avec `viz-subjects` :** `viz-tags` utilise la colonne `keywords` brute (120 termes, pas de seuil minimum) ; `viz-subjects` applique normalisation `titleCase`, déduplication par `Set`, et seuil de 5 occurrences minimum (top 40 uniquement). Les deux clics déclenchent le même filtre `'tag'`.

#### `viz-langs` — Top 30 langues

Barres verticales ordonnées par fréquence décroissante. Colonne `langs` fragmentée par `, ; |`. Clic → filtre `{type:'lang', value:'French'}`.

#### `viz-lang-mono-multi` — Donut monolingue / multilingue

Monolingue = revues avec exactement 1 langue dans `langs`. Multilingue = revues avec ≥ 2 langues. Clic → `{type:'monolingual', value:'mono'}` ou `value:'multi'`.

#### `viz-license` — Donut des licences

Colonne `license`, fragmentée par `| , ;`. Toutes les valeurs distinctes incluses. Légende `type:'scroll'`. Clic → filtre `{type:'license', value:'CC BY'}`.

#### `viz-open-since` — Historique du passage en OA

Barres verticales chronologiques. Extrait l'année depuis la colonne `opensince`. Clic → filtre `{type:'opensince', value:2018}`.

#### `viz-review-process` — Rose chart des processus d'évaluation

Tous les secteurs ont le **même angle** ; seul le **rayon** varie (`roseType:'area'`). Top 14 processus. Clic → filtre `{type:'review', value:'Double Blind'}`.

#### `viz-apc-ratio` — Donut Diamond OA vs avec frais

« Sans frais » = `isApcNoRow()` → champ `apc` vaut `"no"`, `"non"`, `"0"` ou est vide. Clic → active `APC_FILTER_VAL` et met à jour le segmented control `#apc-filter-group`.

#### `viz-apc-country` — Boxplot APC par pays

- Ne retient que les revues avec APC > 0 € et ≤ 15 000 €.
- Conversion en euros via `FX_RATES` (Open Exchange Rates).
- **Statistiques** : `[min, Q1, médiane, Q3, max]` par interpolation linéaire.
- **Tri** : pays ordonnés par médiane croissante.
- Survol → tooltip détaillé. Aucun filtre catalogue au clic.

#### `viz-weeks` — Distribution des délais de publication

- Valeurs retenues : `weeks > 0` et `weeks ≤ 104`.
- **Ligne de médiane** en pointillé amber (`markLine`).
- Aucun filtre au clic.

#### `viz-preservation` — Donut des services de préservation

Combine colonnes `preservation` et `preservationNL`. Valeurs < 2 ou > 80 caractères filtrées. Top 14 services. Clic → filtre `{type:'preservation', value:'CLOCKSS'}`.

#### `viz-persistent-ids` — Taux d'identifiants pérennes

Composant HTML sur mesure : barre de progression globale + barres par type (DOI, PMID, Handle, ARK…). Bouton CSV attaché en bas.

#### `viz-subjects` — Top 40 mots-clés normalisés

Barres verticales en vert émeraude (`#10b981`). Normalisation `canonicalKeyword()`, déduplication par `Set`, seuil `MIN_OCC = 5`. Clic → filtre `{type:'tag', value:'Health'}`.

### 6.6 Catalogue (`#section-list`)

**Filtres disponibles :**
- APC : Toutes / Diamond OA / Avec frais (segmented control `#apc-filter-group`)
- Texte libre : titre, ISSN, eISSN (avec autocomplétion `#cards-autocomplete`)
- Source : AJOL only (`#filter-ajol-btn`)
- Indexation : Crossref only (`#filter-crossref-btn`)
- Filtre global depuis les graphiques (`CURRENTFILTER` + `#active-filter-bar`)

**Tris disponibles :** Date d'ajout DOAJ ↓ (défaut) · A→Z · Z→A · Date dernier article ↓

**Pagination :** Affichage par lots de 99 (`#btn-load-more`).

**Carte de revue — contenu :**
- Titre + point d'activité coloré (position `absolute` top-right)
- Drapeau CSS (`flag-icons`) + pays
- ISSN / eISSN cliquables (lien `portal.issn.org`) avec icône externe
- Badges : langues, licence, APC (rouge si frais), AJOL (si indexé), Crossref
- Pied de carte : bouton « Lire la revue » + bouton DOAJ (logo SVG)

**Attributs `data-*` sur chaque `.card` :**
- `data-in-ajol="true|false"`
- `data-has-crossref="yes|no|pending"`

### 6.7 Formulaire de feedback (`#section-report`)

- Types : Erreur · Suggestion · Problème de données · Autre
- Champs : email (requis), objet (requis), détail (requis, 2 000 chars max avec compteur live)
- Envoi : `mailto:` pré-rempli — ouvre le client mail local, aucune persistance serveur

### 6.8 Fiche revue — citer et exporter

Sur la route `/<issn>` (ou `/openaccess/<id>`), la liste des articles est bâtie par
`renderWork()` à partir des objets Work d'OpenAlex. Le bloc
`<script id="biblio-export-js">` y greffe deux pastilles par notice, via
`window.BIBLIO.decorate(links, work)`.

**Citer.** Ouvre `#cite-modal` : cinq onglets, le texte sélectionnable, et le
téléchargement de la notice seule.

| Format | Règle retenue |
|---|---|
| APA 7 | nom + initiales, `&` final, au-delà de 20 auteurs les 19 premiers puis le dernier (manuel 9.8) |
| MLA 9 | premier auteur inversé, `et al.` à partir de trois |
| Chicago 17 | auteur-date, seul le premier auteur inversé, `et al.` au-delà de dix |
| ISO 690 | nom de famille en capitales, `[en ligne]`, ISSN, `Disponible à l'adresse` |
| BibTeX | clé `auteur+année+mot`, titre en double accolade pour préserver la casse |

Aucune requête supplémentaire : tout est tiré du Work déjà chargé par la liste.
`toRef(work)` produit une référence neutre, chaque format n'en est qu'une mise en
forme. Les téléchargements `.ris` et `.bib` passent par les mêmes fonctions.

**Signet.** Ajoute la référence à un panier conservé dans `localStorage` sous
`oa_biblio_basket_v1`. Le panier ne stocke que les références neutres, pas les
Works entiers. Un bouton flottant « Ma bibliographie » apparaît **en bas à
gauche** dès qu'il contient un article : le coin droit est déjà pris par
`#bookmarks-fab`, le signet des revues, qui est un mécanisme distinct avec son
propre stockage (`oa_bookmarks_v1`). Export groupé en RIS, BibTeX ou CSV.

**Vérification.** `test_biblio.js` extrait le bloc d'`index1.html`, l'évalue avec
un DOM minimal et contrôle les cinq formats, le RIS, le BibTeX, le CSV et les cas
limites : aucun auteur, pas de DOI, un seul auteur, trois et plus, virgule dans le
titre.

```bash
node test_biblio.js
```

---

## 7. Système de filtrage global

```js
let CURRENTFILTER = null; // déclaré dans le bloc principal
// positionné par les graphiques, la carte ou le catalogue
CURRENTFILTER = { type: string, value: any }
```

`applyFilter()` filtre `RAW` selon le type et déclenche `renderAllCards()`.  
`queueScrollToCards()` fait défiler vers `#section-list` après un court délai.

> **Important :** `CURRENTFILTER` doit être déclaré explicitement avec `let CURRENTFILTER = null` dans le même `<script>` que `getFilterLabel()`. Son absence cause une `ReferenceError` dans `renderAllCards()` qui interrompt `initWithData()` avant le masquage de la modale de chargement.

| `type` | Source | `value` |
|---|---|---|
| `country` | Carte Leaflet ou badge pays | Nom du pays (ex : `"Nigeria"`) |
| `lang` | Graphique langues | Nom de la langue |
| `license` | Graphique licences | Nom de la licence |
| `tag` | Nuage de mots ou graphique sujets | Mot-clé en minuscules |
| `opensince` | Graphique années OA | Année (`number`) |
| `addedmonth` | Punch card | `"YYYY-MM"` |
| `apc` | Donut APC | `"yes"` / `"no"` |
| `review` | Rose chart | Nom du processus |
| `monolingual` | Donut mono/multi | `"mono"` / `"multi"` |
| `preservation` | Donut préservation | Nom du service |

### Interrupteurs d'indexation (`DB_FILTER`)

Indépendants de `CURRENTFILTER`, cumulables, câblés par `setupDbToggle()` et
évalués par `_rowInDb(row, dbId)` : `ajol`, `crossref`, `openalex`,
`opencitations`, `scopus`, `wos`, `oai`.

`oai` suit la logique des trois états décrite en 3.5 : une revue dont l'ISSN est
absent de `OAI_MAP` n'a pas encore été sondée et **reste affichée**, comme
`crossref` le fait pour ses résolutions en attente. Seules les revues sondées sans
résultat sortent de la liste. Tant que `/enrichment` ne renvoie aucun objet `oai`,
`markDbUnavailable('oai', 'OAI-PMH')` grise l'interrupteur : actif, il afficherait
le catalogue entier sous une étiquette mensongère.

---

## 8. Dépendances front-end

Toutes chargées via CDN, sans bundler ni étape de build.

| Bibliothèque | Version | Usage | Licence |
|---|---|---|---|
| **PapaParse** | 5.4.1 | Parsing du CSV AJOL et fallback CSV Worker | MIT |
| **Apache ECharts** | 5.4.3 | 12 graphiques interactifs | Apache 2.0 |
| **D3.js** | 7 | Nuage de mots (SVG) | ISC |
| **d3-cloud** | 1 | Algorithme de layout nuage de mots | MIT |
| **Leaflet.js** | 1.9.4 | Carte interactive | BSD-2 |
| **jsPDF** | 2.5.1 | Export recommandations en PDF | MIT |
| **flag-icons** | 7.2.3 | Drapeaux CSS par code ISO2 | MIT |
| **Google Fonts** | — | Polices Manrope + Inter | OFL |
| **Material Symbols** | — | Icônes outlined | Apache 2.0 |

---

## 9. Cloudflare Worker — Détails d'implémentation

**Fichier :** `worker/worker.js`

### Parser CSV maison

Implémentation RFC 4180 complète sans dépendance externe :
- Gère les champs entre guillemets doubles
- Gère les guillemets échappés (`""`)
- Normalise les fins de ligne `\r\n` et `\n`

### Détection de colonnes (`findColumn`)

Stratégie de matching en cascade :
1. Correspondance exacte
2. Correspondance insensible à la casse
3. Sous-chaîne insensible à la casse

### Normalisation des pays (`canonicalCountry`)

- `"Cote d'Ivoire"` → `"Côte d'Ivoire"`
- `"Sao Tome and Principe"` → `"São Tomé and Príncipe"`

### Stockage KV

| Clé KV | Contenu | TTL |
|---|---|---|
| `african_journals` | Tableau JSON des revues filtrées | 30 jours |
| `african_journals_meta` | `{ cachedAt, count, totalRows }` | 30 jours |
| `oai_cache` | `{ ISSN: {url, name, granularity, earliest} | false }` | 35 jours |
| `oai_cache_meta` | `{ generated, journals, refreshedFrom, refreshed, checked, found }` | 35 jours |
| `oai_cursor` | Index de reprise du balayage OAI-PMH | 35 jours |

`oai_cache` vit dans sa propre clé, et non dans l'objet d'enrichissement : son cron
écrit tous les quarts d'heure, alors que `enrichment_cache` reçoit en continu les
retours des navigateurs via `/report-oa`, `/report-oc` et `/report-cr`. Les mêler
ferait perdre ces retours. La fusion n'a lieu qu'à la lecture, dans `/enrichment`.

### Cold start non-bloquant

Lorsque le KV est vide, le Worker déclenche le rebuild en arrière-plan via `ctx.waitUntil()` et retourne immédiatement un `503` avec le message *« Cache warming up — please retry in a few minutes. »*

```
KV vide ?
  ├── Oui → ctx.waitUntil(buildCache()) + 503 immédiat
  └── Non → 200 + JSON depuis KV
```

> **Avant (v1) :** `buildCache()` était appelé de manière synchrone, bloquant le client plusieurs minutes le temps de télécharger et parser le CSV DOAJ complet.

### Cron

Deux horaires, déclarés dans `wrangler.toml`, distingués dans `scheduled()` par
`event.cron` :

| Horaire | Travail |
|---|---|
| `0 3 * * SUN` | Corpus DOAJ (`buildCache`, `buildWorldCache`) puis une tranche Crossref |
| `*/15 * * * *` | Une tranche du balayage OAI-PMH (`sweepOai`) |

Ils ne peuvent pas partager une invocation : le plan gratuit plafonne à **50
sous-requêtes par invocation**, et le passage du dimanche télécharge déjà deux fois
le CSV du DOAJ. Le balayage consomme jusqu'à 48 requêtes à lui seul — 8 revues par
passage, 6 URL candidates au pire. Les 8 revues sont sondées en parallèle, leurs
candidates en série : la ressource rare est le nombre de sous-requêtes, pas le
temps. Le corpus complet (≈ 960 revues) est couvert en une trentaine d'heures, puis
le curseur boucle, ce que le TTL de 35 jours impose de toute façon.

> Cloudflare prévient qu'ajouter ou modifier un cron **met jusqu'à 15 minutes à se
> propager**, et que les invocations tombant dans cet intervalle sont perdues. Après
> un `wrangler deploy`, ne pas conclure trop vite qu'un cron ne part pas.

### CORS

`Access-Control-Allow-Origin: *` sur toutes les réponses.

---

## 10. Déploiement

### Worker Cloudflare

```bash
# 1. Créer les namespaces KV
wrangler kv:namespace create DOAJ_KV
wrangler kv:namespace create DOAJ_KV --preview
# Coller les IDs retournés dans wrangler.toml

# 2. Définir le secret de rafraîchissement
wrangler secret put REFRESH_SECRET

# 3. Déployer
wrangler deploy

# 4. Pré-remplir le cache KV immédiatement (optionnel)
# GET https://<worker-url>/refresh?secret=<REFRESH_SECRET>

# 5. Lancer une tranche du balayage OAI-PMH sans attendre le cron
# GET https://<worker-url>/oai-sweep?secret=<REFRESH_SECRET>
```

`/oai-sweep` partage le secret de `/refresh`. Chaque appel avance le curseur de 8
revues et renvoie le compte-rendu du passage :

```json
{"ok":true,"generated":"2026-11-20T22:03:12.077Z","journals":956,
 "refreshedFrom":0,"refreshed":8,"checked":16,"found":2}
```

Appelée en boucle, elle remplit le corpus bien plus vite que le quart d'heure.

> Après un redéploiement sur un KV vide, appeler `/refresh?secret=...` pour pré-remplir le cache immédiatement plutôt que d'attendre le prochain cron ou la première requête client.

### Application front-end

Fichier statique unique, compatible avec tout hébergeur statique (cPanel, GitHub Pages, Cloudflare Pages, Netlify…).

L'URL du Worker est codée en dur dans `index.html` :

```js
const REMOTECSVURL   = "https://doaj-african-cache.ynnonazaline.workers.dev/csv";
const ENRICHMENT_URL = "https://doaj-african-cache.ynnonazaline.workers.dev/enrichment";
```

> `/enrichment` porte `Cache-Control: public, max-age=3600,
> stale-while-revalidate=82800`. Une donnée fraîchement balayée peut donc mettre une
> heure à atteindre un visiteur déjà venu, et jusqu'à 23 h si la bordure sert une
> copie périmée. C'est voulu pour le flux `/report-*`, mais cela surprend quand on
> vérifie un balayage : utiliser `fetch(url, {cache:'reload'})` ou un paramètre
> d'URL jetable pour voir l'état réel.

---

## 11. Résilience du chargement

### Overlay de chargement (`#loading-overlay`)

| Temps écoulé | Message |
|---|---|
| 0 s | Connexion au serveur DOAJ… |
| 5 s | Récupération des données… |
| 20 s | Traitement des revues africaines… |
| 40 s | Démarrage à froid du serveur — veuillez patienter… |
| 60 s | Presque prêt… encore quelques instants… |

### Timeout fetch (90 secondes)

```js
const controller = new AbortController();
const fetchTimer = setTimeout(() => controller.abort(), 90000);
try {
  resp = await fetch(REMOTECSVURL, { cache: "no-store", signal: controller.signal });
} finally {
  clearTimeout(fetchTimer);
}
```

### Modale de secours (`#csv-modal`)

Affichée uniquement en cas d'échec de `tryFetchCSV()`. Propose trois actions :

1. **Réessayer** — relance `startLoad()` avec un nouvel overlay
2. **Télécharger le CSV DOAJ** — lien direct vers `https://doaj.org/csv/journals`
3. **Upload manuel** — `<input type="file" accept=".csv">` : PapaParse parse le CSV local et `initWithData()` initialise l'application normalement

---

## 12. Points d'attention

| Sujet | Détail |
|---|---|
| **Monofichier sans build** | CSS et JS entièrement inline dans `index.html`. Aucune étape de compilation requise. |
| **Override CSS global** | La couche *Linear dark overhaul* impose le mode sombre via `!important` sur `:root`. Les classes `.dark` et `.sepia` et le toggle de thème sont sans effet visible sur le rendu final. |
| **Cache API vs localStorage** | Le cache client utilise `caches.open()` (Cache API), **pas** `localStorage`. Sur `file://`, certains navigateurs peuvent restreindre l'accès ; dans ce cas, `tryFetchCSV()` passe directement par le Worker à chaque chargement. |
| **`CURRENTFILTER` — déclaration obligatoire** | Cette variable globale doit être initialisée à `null` dans le même `<script>` que `getFilterLabel()`. Son absence cause une `ReferenceError` qui interrompt `initWithData()` avant le masquage de la modale de chargement. |
| **Cron mensuel uniquement** | Le `wrangler.toml` déploie un seul trigger (`0 0 1 * *`). Après un redéploiement, appeler `/refresh` manuellement pour pré-remplir le KV. |
| **Cold start Worker** | Si le KV est vide, le Worker retourne 503 immédiatement (rebuild en arrière-plan). Le rebuild prend généralement 1 à 3 minutes selon la disponibilité de `doaj.org`. |
| **Feedback sans serveur** | Le formulaire ouvre un `mailto:` dans le client mail local. Aucune donnée n'est envoyée ni stockée côté serveur. |
| **Boxplot APC** | `viz-apc-country` utilise le type `boxplot` d'ECharts. Les montants > 15 000 € ou négatifs sont exclus du calcul. |
| **Enrichissement Crossref/OpenAlex** | Appels déclenchés card par card au rendu, peuvent échouer silencieusement (timeout, rate-limit). Erreurs loguées en `console.warn`, sans impact sur le chargement principal. |

---

*Documentation technique — Observatoire des revues africaines en libre accès · V4.1 · Innocent Azilan · [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) · juin 2026*
