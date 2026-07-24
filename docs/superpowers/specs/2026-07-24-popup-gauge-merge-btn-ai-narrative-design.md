# Design — Popup articles : jauge de disponibilité, fusion des boutons OpenAlex, résumé IA narratif

**Date :** 2026-07-24
**Statut :** Approuvé

---

## Objectif

Quatre améliorations du popup articles (`#oa-works-modal`) et des cartes de revues :
1. Jauge visuelle du % d'articles avec PDF/HTML disponible
2. Fusion des deux boutons OpenAlex des cartes en un seul
3. Résumé IA plus riche (texte narratif au lieu d'une liste de thèmes) + renommage du bouton
4. Bouton pour réduire le résumé IA généré

---

## 1. Jauge de disponibilité PDF/HTML

### Calcul

Basé sur la **totalité** des articles de la revue (pas seulement les 25 premiers chargés dans le popup), via deux requêtes légères vers l'API OpenAlex (`per-page=1`, on ne lit que `meta.count`) :

- Total : `https://api.openalex.org/works?filter=primary_location.source.id:{sourceId}&per-page=1`
- Avec accès (PDF ou lien HTML) : `https://api.openalex.org/works?filter=primary_location.source.id:{sourceId},open_access.oa_url:!null&per-page=1`

`open_access.oa_url` est le champ qu'OpenAlex remplit dès qu'une localisation en accès ouvert existe (PDF ou page d'atterrissage) — c'est le même signal que `bestPdfUrl()`/`bestHtmlUrl()` utilisent déjà pour afficher les boutons PDF/HTML par article, donc le calcul reste cohérent avec ce que l'utilisateur voit dans la liste.

Pourcentage = `round(withLink / total * 100)`. Si `total === 0` ou une des requêtes échoue, la jauge reste masquée (`display:none`), pas de message d'erreur (cohérent avec `loadSourceCard` qui échoue silencieusement).

### Déclenchement

Chargée automatiquement à l'ouverture du popup (`openWorksModal`), comme `renderPubYearChart`/`loadSourceCard`. Protégée par le même `state.token` pour ignorer une réponse obsolète si l'utilisateur change de revue pendant le chargement.

### UI

Nouveau bloc `#oa-availability-wrap`, placé juste avant `#oa-pubyear-chart-wrap` (donc entre l'en-tête du popup et le module IA), en flex row :
- à gauche : `#oa-availability-gauge` (110×110px)
- à droite : texte `"X% des articles disponibles en PDF ou HTML"` (gras) + ligne muted `"Y sur Z articles"`

Masqué par défaut (`display:none`), affiché seulement si le calcul aboutit.

### Jauge ECharts

Reprend la structure de l'exemple officiel **Progress Gauge** (`echarts.apache.org/examples/en/editor.html?c=gauge-progress`) : arc de progression sans aiguille, `detail` centré avec `formatter:'{value}%'`. Adapté aux couleurs du thème (clair/sombre/sépia, mêmes variables que `renderPubYearChart` : `isDark()`, `isSepia()`, accent `#2563eb`/`#93c5fd`/`#b45309`).

```js
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
```

---

## 2. Fusion des boutons OpenAlex (cartes de revues)

Dans `addOAButton(card, oaData)` (script `openalex-works-modal` amont, ~ligne 5947) :
- L'élément `a.openalex-btn` (lien externe direct vers `oaData.id`) est remplacé par un `button.openalex-btn` (même contenu : compteur + logo, même classe CSS donc même style visuel).
- Son `click` appelle `window._oaOpenWorksModal(oaData, journalTitle)` — exactement ce que fait le bouton loupe aujourd'hui.
- Le bouton loupe séparé (`.openalex-works-btn`) est supprimé.
- Le lien externe vers la fiche OpenAlex reste accessible : le titre du popup (`#oa-works-title`) est déjà un lien cliquable vers `oaData.id` (`oa-works-title-link`, existant, inchangé).
- CSS : `.openalex-btn` gagne `font-family:inherit;` (nécessaire maintenant qu'il peut être un `<button>`, les autres boutons du fichier le font déjà).
- Tooltip (`attachTip`) : conservé sur le bouton fusionné, texte inchangé (compteur d'articles indexés).

---

## 3. Résumé IA narratif

### Frontend (`index.html`, script `openalex-works-modal`)

- Renommage du libellé initial du bouton, aux deux endroits où il apparaît en dur :
  - HTML statique de `#oa-topics-btn`
  - `resetTopicsUI()` (état sans cache)
  - Texte : **"Découvrir les sujets publiés par la revue"** (au lieu de "Générer les sujets principaux")
  - Les états `"Régénérer"` et `"Réessayer"` restent inchangés (non demandé).
- `generateTopics()` envoie désormais aussi le titre de la revue au Worker : `body: JSON.stringify({ abstracts, title: state.journalTitle })`.

### Worker (`worker/worker.js`, endpoint `POST /topics`)

- Accepte un champ optionnel `title` (string) en plus de `abstracts`.
- Nouveau prompt système, orienté texte continu plutôt que liste :
  > "Tu es un assistant qui rédige une courte présentation éditoriale d'une revue scientifique à partir de résumés d'articles qu'elle a publiés. Rédige un texte fluide de 3 à 5 phrases, en français, qui décrit les grandes thématiques de recherche abordées par la revue en les regroupant (n'énumère jamais les articles un par un, ne cite aucun titre d'article). Commence par une phrase qui nomme la revue telle qu'elle t'est donnée. N'utilise ni tiret, ni liste à puces, ni titre : uniquement du texte continu."
- Message utilisateur : `"Nom de la revue : " + (title || "cette revue") + "\n\nRésumés d'articles :\n" + combined`
- `max_tokens` porté de 400 à 450 (texte narratif légèrement plus long que la liste actuelle).
- Reste inchangé : troncature à 100 résumés / 8000 caractères, gestion d'erreur `ai_failed`/`no_abstracts`, CORS.

⚠️ **Redéploiement requis** : `wrangler deploy` depuis `worker/`, à faire par l'utilisateur après implémentation (pas d'accès direct à son compte Cloudflare depuis cette session).

---

## 4. Bouton pour réduire le résumé généré

Le résultat généré n'est plus un simple `textContent` mais une petite structure DOM à l'intérieur de `#oa-topics-result` :
- `.oa-topics-text` : le texte du résumé
- `.oa-topics-collapse-btn` : bouton icône (`expand_less`/`expand_more`), positionné en haut à droite du bloc résultat

Clic sur le bouton → toggle de la classe `collapsed` sur `#oa-topics-result` :
- Replié : `.oa-topics-text` passe à `max-height:44px; overflow:hidden` avec un masque de fondu (`mask-image` dégradé), l'icône devient `expand_more`, titre "Développer"
- Déplié : `max-height` généreux (transition CSS douce), icône `expand_less`, titre "Réduire"

Pas de perte de contenu ni de nouvel appel réseau — le texte reste en mémoire/DOM, seul l'affichage change. Ce comportement ne s'applique qu'au résultat réussi (les messages d'erreur restent en simple texte, sans bouton).

---

## Fichiers modifiés

- `index.html` : jauge de disponibilité + fusion boutons OpenAlex + renommage bouton IA + toggle réduire
- `worker/worker.js` : prompt `/topics` réécrit, accepte `title`

## Hors scope

- Pas de traduction multi-langue du résumé (toujours en français)
- Pas de cache serveur pour la jauge de disponibilité (recalculée à chaque ouverture du popup)
- Pas de changement du comportement de cache `sessionStorage` existant pour le résumé IA
