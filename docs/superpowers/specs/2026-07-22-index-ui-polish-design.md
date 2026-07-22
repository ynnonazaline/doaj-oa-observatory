# Design — index.html : Polish titres, plein écran graphique, refonte popup articles

**Date :** 2026-07-22
**Statut :** Approuvé

---

## Objectif

Série de 13 ajustements visuels et fonctionnels sur `index.html` (site principal), répartis en trois groupes :
1. Réduction de la taille des titres principaux du site
2. Ajout d'un bouton plein écran sur le graphique « Réseau d'indexation des revues »
3. Refonte du popup « articles indexés » (`#oa-works-modal`) : theming, nettoyage de champs, enrichissement par article, enrichissement au niveau revue

---

## 1. Titres du site (-10px)

Cibles :
- `.title` (titre d'en-tête du site)
- `.section-title` (actuellement `clamp(1.09rem, 1.82vw, 1.71rem)`)
- `.card-title` (actuellement `17px`, avec overrides responsive à `15px`/`14.5px`)

Règle : réduire chaque taille de ~10px, avec un plancher de lisibilité (~13-14px min) pour éviter que les variantes déjà réduites (mobile, `.card-title` à 14.5px) ne deviennent illisibles. Pas de changement sur le titre du popup articles (`.oa-works-head-title`, 20px) ni sur les petits libellés (`.subtle`, badges, etc.).

---

## 2. Bouton plein écran — Réseau d'indexation des revues

Réplique le pattern existant `#btn-map-fullscreen` (lignes ~1231-1236, ~3105-3120) :
- Envelopper `#viz-indexation-graph` dans un conteneur `position:relative` (`#viz-indexation-graph-wrap`)
- Bouton absolu (coin haut-droit) utilisant l'API Fullscreen native (`requestFullscreen` / `exitFullscreen`)
- Icône bascule `fullscreen` ↔ `fullscreen_exit` sur `fullscreenchange`
- CSS `:fullscreen` pour agrandir le conteneur du graphique (même règles que `#viz-map:fullscreen`)
- ECharts doit être resize() à l'entrée/sortie du plein écran (comme fait pour la carte)

---

## 3. Popup articles (`#oa-works-modal`)

### 3.1 Correction du mode sépia (bug racine identifié)

Les variables CSS `--text`, `--muted`, `--card`, `--card-solid`, `--card-border`, `--accent`, `--chip-bg` ne sont définies que pour `html:not(.dark)` (clair) et `html.dark`. Le sélecteur `html:not(.dark)` matche aussi `.sepia` (qui n'a pas la classe `dark`), donc le popup hérite toujours des couleurs du thème clair en mode sépia.

Fix : ajouter un bloc `html.sepia { --text:#2c1a0a; --muted:#7c4a1e; --card-solid:...; --card-border:rgba(160,115,60,.20); --accent:#b45309; --chip-bg:...; ... !important }` placé après le bloc `html:not(.dark)` existant, cohérent avec la palette sépia déjà utilisée dans les graphiques ECharts (`#2c1a0a`, `#7c4a1e`, `#b45309`, `rgba(250,244,230,...)`).

### 3.2 Nettoyage de la carte source (`renderSourceCard`)

Supprimer les lignes : Type de source, Éditeur, Accès ouvert, Dans le DOAJ. Ne conserver que la ligne ISSN.

### 3.3 Redesign bouton PDF au survol (`.oa-work-pdf-btn`)

Actuellement : simple changement de couleur de bordure/texte au survol. Nouveau style au survol :
- Fond dégradé subtil (teinte accent)
- Ombre portée douce + léger `translateY`/`scale`
- Icône PDF (material symbol) en plus du texte
- Transition cohérente avec `.openalex-works-btn:hover` déjà présent sur le site

### 3.4 Résumé dépliable

- Reconstruire le texte depuis `work.abstract_inverted_index` (format OpenAlex : `{mot: [positions...]}`) → fonction `invertedIndexToText()`
- Bouton toggle « Résumé ▾ / ▴ » sous les métadonnées de chaque article ; zone de texte repliée par défaut (`max-height:0` → auto via classe `.expanded`)
- Si pas d'abstract disponible, ne pas afficher le bouton

### 3.5 Retrait du nombre de citations

Supprimer `<span class="oa-work-cited">` et la variable `cited` dans `renderWork()`.

### 3.6 Subfield par article

Badge affichant `work.primary_topic.subfield.display_name` (si présent), à côté des métadonnées existantes (année, auteurs, revue).

### 3.7 Lien HTML à côté du PDF

Si `best_oa_location.landing_page_url` existe et diffère de l'URL du PDF, afficher un second lien/bouton « HTML » à côté du bouton PDF (même style, variante secondaire).

### 3.8 Langue de l'article

Affichage de `work.language` (code ISO) traduit en nom lisible via `Intl.DisplayNames(['fr'], {type:'language'})`, ajouté dans la ligne meta.

### 3.9 Lien OpenAlex sur le titre de la revue

Le titre dans l'en-tête du popup (`#oa-works-title`) devient un lien `<a>` vers `oaData.id` (ouverture nouvel onglet), au lieu d'un simple texte.

### 3.10 Graphique courbe — publications par an

- Source de données : `counts_by_year` déjà présent dans l'objet complet `sources/{id}` (déjà fetché par `loadSourceCard`/`renderSourceCard`)
- Nouveau conteneur ECharts sous la carte ISSN, line chart trié par année croissante, axes minimalistes cohérents avec le thème (clair/sombre/sépia)
- Rendu dans `renderSourceCard()`/`loadSourceCard()`, réutilise `ecInit()` existant

---

## Décisions issues des questions de clarification

- **Titres** : uniquement les titres principaux (hero, section, card) ; popup et petits libellés non concernés ; plancher de lisibilité appliqué plutôt que -10px strict partout.
- **Carte source** : ne garder que l'ISSN après suppression des 4 champs listés.

---

## Hors scope

- Pas de nouvel appel API pour l'abstract/subfield/langue : tout provient de l'objet `work` déjà renvoyé par l'appel `/works` existant (pas de `select=` limitant les champs)
- Pas de fetch additionnel pour le graphique par an : réutilise `counts_by_year` déjà chargé
- Pas de refonte du design du popup au-delà des points listés
