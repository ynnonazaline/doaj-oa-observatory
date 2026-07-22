# Design — Popup articles : nettoyage supplémentaire + module IA "sujets principaux"

**Date :** 2026-07-22
**Statut :** Approuvé

---

## Objectif

Suite aux ajustements précédents du popup articles (`docs/superpowers/specs/2026-07-22-index-ui-polish-design.md`), trois changements supplémentaires :
1. Retirer le nom de la revue de la ligne meta de chaque article (redondant avec le titre du popup)
2. Retirer la carte ISSN de l'en-tête du popup — ne garder que le titre
3. Ajouter un module IA générant, à la demande, les principaux sujets de recherche d'une revue à partir des résumés de ses articles collectés sur OpenAlex

---

## 1. Retrait du nom de la revue par article

Dans `renderWork()`, la ligne meta contient actuellement `(année) · (auteurs) · <span class="oa-work-journal">(titre revue)</span> · (langue)`. Le titre de la revue est déjà visible dans l'en-tête du popup — on retire ce segment et la classe CSS `.oa-work-journal` associée.

## 2. Retrait de la carte ISSN

`#oa-source-card` (qui n'affichait plus que l'ISSN depuis le nettoyage précédent) est supprimé du DOM, avec son CSS (`.oa-source-card`, `.oa-source-row`, `.oa-source-divider`). La fonction `renderSourceCard()` est supprimée ; ses deux appelants (`loadSourceCard()` et `openWorksModal()`) appellent directement `renderPubYearChart(counts_by_year)`. La condition de branchement dans `openWorksModal` (cache d'enrichissement vs objet complet) devient `if(oaData.counts_by_year)` au lieu de tester `issn`/`type`/`host_organization_name`.

---

## 3. Module IA — sujets principaux de la revue

### Choix technique

**Cloudflare Workers AI** (modèle `@cf/meta/llama-3.1-8b-instruct`, open-weight), appelé depuis le Worker existant (`worker/worker.js`) via un binding natif — aucune clé API, aucun compte tiers, lié au compte Cloudflare qui héberge déjà ce Worker. Quota gratuit quotidien (10 000 Neurons/jour) largement suffisant pour un usage déclenché à la demande.

Alternatives écartées : Groq (nécessite une clé API externe), transformers.js côté navigateur (téléchargement de modèle ~50-100 Mo, latence et qualité multilingue inférieures), analyse de fréquence sans IA générative (ne répond pas à la demande d'une vraie synthèse).

### `worker/wrangler.toml`

Ajout :
```toml
[ai]
binding = "AI"
```

### `worker/worker.js` — nouvel endpoint `POST /topics`

- Accepte `{ abstracts: string[] }` en JSON.
- Validation côté serveur (indépendante de ce qu'envoie le frontend, pour éviter tout abus si l'endpoint est appelé directement) :
  - Rejette si `abstracts` n'est pas un tableau, ou vide.
  - Tronque à 100 éléments max.
  - Concatène et tronque le texte total à 8000 caractères max.
  - Si après filtrage il ne reste aucun texte exploitable → `400` avec `{ error: "no_abstracts" }`.
- Construit le prompt :
  ```
  system: "Tu es un assistant qui analyse des résumés d'articles scientifiques et identifie les principaux thèmes de recherche d'une revue académique. Réponds uniquement en français, sous forme d'une liste concise de 5 à 8 thèmes (un thème par ligne, précédé d'un tiret), sans introduction ni conclusion."
  user: <résumés concaténés, séparés par "\n\n---\n\n">
  ```
- Appelle `env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages: [...], max_tokens: 400 })`.
- Retourne `{ topics: "<texte généré>" }` avec les en-têtes CORS existants (`CORS` déjà défini dans le fichier).
- En cas d'erreur du modèle → `502` avec `{ error: "ai_failed" }`.

### Frontend (`index.html`, script `openalex-works-modal`)

**Nouvelle constante :**
```js
var TOPICS_URL = 'https://doaj-african-cache.ynnonazaline.workers.dev/topics';
```

**UI** : nouveau bloc placé juste après `#oa-pubyear-chart-wrap` et avant `#oa-works-body`, structure :
```html
<div id="oa-topics-wrap" class="oa-topics-wrap">
  <button id="oa-topics-btn" type="button" class="oa-topics-btn">
    <span class="material-symbols-outlined">auto_awesome</span>
    Générer les sujets principaux
  </button>
  <div id="oa-topics-result" class="oa-topics-result" style="display:none;"></div>
</div>
```
Ce bloc est réinitialisé (bouton visible, résultat vidé/caché) à chaque ouverture du popup (`openWorksModal`), sauf si un résultat est déjà en cache pour cette revue (voir cache ci-dessous), auquel cas il est affiché directement.

**Comportement au clic (`#oa-topics-btn`)** :
1. Vérifie le cache `sessionStorage['oa-topics-cache']` (objet JSON `{ [sourceId]: topicsText }`). Si présent pour `state.sourceId`, affiche directement sans appel réseau.
2. Sinon : passe le bouton en état chargement (texte "Analyse en cours…", désactivé).
3. Fetch OpenAlex : `https://api.openalex.org/works?filter=primary_location.source.id:{sourceId}&sort=publication_date:desc&per-page=100&select=abstract_inverted_index`.
4. Reconstruit chaque résumé avec `invertedIndexToText()` (déjà définie), filtre les vides.
5. Si aucun résumé exploitable → affiche "Résumés insuffisants pour générer une synthèse." dans `#oa-topics-result`, réactive le bouton en "Réessayer".
6. Sinon, concatène les résumés (séparateur `\n\n---\n\n`) et tronque à 8000 caractères ; `POST` vers `TOPICS_URL` avec `{ abstracts: [...] }`.
7. Réponse OK → affiche `data.topics` dans `#oa-topics-result` (converti en liste à puces si le texte contient des lignes commençant par `-`), stocke en cache sessionStorage, bouton devient "Régénérer".
8. Échec réseau/serveur → affiche "Impossible de générer les sujets pour le moment." et un bouton "Réessayer".
9. Un `token` de requête (comme `state.token` déjà utilisé pour `loadPage`) protège contre l'affichage d'un résultat obsolète si l'utilisateur change de revue pendant le chargement.

**CSS** : bouton cohérent avec le style des boutons existants du popup (`--card-solid`, `--accent`), icône `auto_awesome`. Résultat affiché dans un encart `border:1px solid var(--card-border); border-radius:14px; background:var(--card)`, texte `font-size:13px; line-height:1.7`.

---

## Fichiers modifiés

- `index.html` : retrait nom de revue + carte ISSN (déjà fait, committé), ajout module IA
- `worker/worker.js` : nouvel endpoint `/topics`
- `worker/wrangler.toml` : binding `[ai]`

## Déploiement

Le nouvel endpoint ne fonctionnera qu'après redéploiement du Worker (`wrangler deploy` depuis `worker/`, comme pour les changements précédents de `worker.js`). À faire par l'utilisateur après implémentation (pas d'accès direct à son compte Cloudflare depuis cette session).

## Hors scope

- Pas de cache persistant côté Worker/KV des résultats — sessionStorage client uniquement
- Pas de génération automatique à l'ouverture du popup — uniquement à la demande (clic)
- Pas de traduction multi-langue du résultat généré (toujours en français, quelle que soit la langue des résumés sources)
- Pas de limitation de débit (rate limiting) avancée côté Worker au-delà des plafonds de taille de payload
