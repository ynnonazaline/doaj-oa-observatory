# Design — V5 : popup agrandi, jauge fidèle à l'exemple ECharts, résumé IA avec Domain/Subfield OpenAlex

**Date :** 2026-07-25
**Statut :** Approuvé

---

## Objectif

Quatre changements, en continuité directe du travail V4 (specs du 2026-07-24) :
1. Bump de version dans le footer : V4 → V5
2. Popup articles agrandi
3. Jauge de disponibilité PDF/HTML fidèle à l'exemple officiel ECharts *Progress Gauge*, placée côte à côte avec le graphique "Publications par an"
4. Résumé IA enrichi avec le domaine et les sous-disciplines OpenAlex de la revue (`primary_topic.domain` / `primary_topic.subfield`)

---

## 1. Version du footer

`index.html:1523` — remplacer `V4` par `V5` dans :
```html
<div><strong style="color:var(--text);">V4</strong> — 2026 · Mise à jour automatique mensuelle des données DOAJ.</div>
```
→
```html
<div><strong style="color:var(--text);">V5</strong> — 2026 · Mise à jour automatique mensuelle des données DOAJ.</div>
```
(Ne pas toucher à "Documentation technique — V4.1" ligne 1509, qui est un numéro de version distinct, non concerné par cette demande.)

---

## 2. Popup agrandi

`#oa-works-modal .oa-works-inner` (`index.html:5985-5989`) :
```css
width:min(660px, 94vw); max-height:min(720px, 88vh);
```
→
```css
width:min(860px, 96vw); max-height:min(820px, 90vh);
```

---

## 3. Jauge fidèle à l'exemple ECharts + mise en page côte à côte

### Pourquoi ce changement

La jauge actuelle (implémentée en V4) est une version simplifiée (anneau fin sans graduation, sans étiquette, sans ancre, sans aiguille). L'utilisateur demande explicitement d'utiliser la structure de l'exemple officiel *Progress Gauge* (`https://echarts.apache.org/examples/en/editor.html?c=gauge-progress`), dont le code source exact (vérifié en interceptant la requête réseau de la page d'exemple, pas deviné) est :

```js
option = {
  series: [{
    type: 'gauge',
    progress: { show: true, width: 18 },
    axisLine: { lineStyle: { width: 18 } },
    axisTick: { show: false },
    splitLine: { length: 15, lineStyle: { width: 2, color: '#999' } },
    axisLabel: { distance: 25, color: '#999', fontSize: 20 },
    anchor: { show: true, showAbove: true, size: 25, itemStyle: { borderWidth: 10 } },
    title: { show: false },
    detail: { valueAnimation: true, fontSize: 80, offsetCenter: [0, '70%'] },
    data: [{ value: 70 }]
  }]
};
```

Notable : cet exemple ne définit ni `startAngle`/`endAngle` (donc l'arc par défaut ECharts ~270°, pas un cercle complet), ni `pointer` (donc l'aiguille par défaut ECharts reste visible, superposée à l'arc de progression), ni `min`/`max` (défauts déjà 0/100, ce qui correspond à notre cas d'usage).

### Adaptation nécessaire (documentée, pas une divergence silencieuse)

On reprend cette structure **telle quelle** (progress, axisLine, axisTick, splitLine, axisLabel, anchor, title, detail avec `offsetCenter:[0,'70%']` et `valueAnimation`), sans ajouter `startAngle`/`endAngle`/`min`/`max`/`pointer` — on laisse les défauts ECharts s'appliquer, exactement comme le fait l'exemple. Seules différences, nécessaires et justifiées :
- Couleurs thémées (`accentColor`/`trackColor`/`mutedColor`/`textColor` selon `isDark()`/`isSepia()`, même logique que `renderPubYearChart`) au lieu du gris neutre `#999` de l'exemple — l'app a déjà un système de thème clair/sombre/sépia à respecter.
- Tailles (`width`, `length`, `fontSize`, `size`) réduites proportionnellement, l'exemple étant conçu pour un grand canevas d'éditeur alors que notre jauge tient dans une carte de popup.
- `detail.formatter:'{value}%'` ajouté, car notre valeur est un pourcentage (l'exemple affiche `70` brut, sans unité).

### Mise en page côte à côte

Nouveau conteneur `.oa-charts-row` (flex row, `gap:12px`) englobant `#oa-availability-wrap` et `#oa-pubyear-chart-wrap`, chacun `flex:1 1 0; min-width:0`, chacun gardant sa propre carte (bordure/fond). Sous 480px de large, la ligne repasse en colonne (`flex-direction:column`) via une media query, pour rester lisible sur mobile.

La jauge se suffisant à elle-même pour afficher le pourcentage (via son `detail`), on retire la ligne de texte externe redondante `#oa-availability-pct` ("X % des articles disponibles..."). On garde uniquement une légende sous la jauge (`#oa-availability-count`, ex. "318 sur 342 articles") et un titre au-dessus (`.oa-availability-title`, ex. "Disponibilité des textes"), symétrique au titre "Publications par an" du graphique voisin.

### `renderAvailabilityGauge(withLink, total)` — nouvelle option

```js
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
```

---

## 4. Résumé IA — Domain + Subfield OpenAlex

### Extraction (frontend, `generateTopics()`)

Le `select` de la requête OpenAlex déjà utilisée pour récupérer les résumés passe de `abstract_inverted_index` à `abstract_inverted_index,primary_topic` — **aucun appel réseau supplémentaire**, le même lot de 100 articles est réutilisé.

Pour chaque `work` du résultat, on compte les occurrences de `work.primary_topic.domain.display_name` et `work.primary_topic.subfield.display_name` (works sans `primary_topic` ignorés). Le domaine dominant (le plus fréquent) est traduit via une table fixe — OpenAlex n'a que 4 domaines possibles, donc une table statique est fiable, pas fragile :

```js
var DOMAIN_FR = {
  'Health Sciences': 'santé',
  'Life Sciences': 'sciences de la vie',
  'Physical Sciences': 'sciences physiques',
  'Social Sciences': 'sciences humaines et sociales'
};
```

Les 3 sous-disciplines (`subfield.display_name`) les plus fréquentes sont prises telles quelles, **en anglais** (OpenAlex ne les traduit pas, et une table de correspondance pour ~250 valeurs serait disproportionnée) — c'est le Worker/modèle qui les traduira naturellement en français dans la phrase générée (tâche de traduction courte et peu risquée pour un modèle 8B, à la différence d'une invention de fait).

`generateTopics()` envoie désormais `{ abstracts, title, domain, subfields }` au lieu de `{ abstracts, title }` (`domain` : string en français ou `null` ; `subfields` : tableau de 0 à 3 chaînes anglaises).

### Worker (`worker/worker.js`, endpoint `/topics`)

Accepte `domain` (string|null) et `subfields` (string[], tronqué à 3 côté serveur par sécurité). Construit un bloc de faits factuel injecté dans le message utilisateur, et **bascule entre deux prompts système** selon que domain/subfields sont exploitables ou non :

- **Avec domaine et/ou sous-disciplines** : le prompt impose une première phrase au format exact `"[Nom de la revue] est une revue en [domaine], spécialisée en [sous-discipline 1], [sous-discipline 2] et [sous-discipline 3]."` (liste adaptée à 1, 2 ou 3 éléments ; si domaine absent mais sous-disciplines présentes, ouverture "[Nom] est une revue spécialisée en [...]."), suivie de 2 à 4 phrases narratives sur les thématiques à partir des résumés — même logique de regroupement/absence de tirets que V4.
- **Sans domaine ni sous-discipline** (repli) : prompt V4 inchangé mot pour mot (déjà en production, déjà testé) — la revue s'ouvre directement sur une phrase nommant la revue à partir des résumés, sans domaine inventé.

`max_tokens` reste à 450 (le texte généré reste dans la même fourchette de longueur qu'en V4, la phrase d'ouverture structurée remplaçant simplement la phrase d'ouverture libre).

---

## Fichiers modifiés

- `index.html` : footer version, taille popup, jauge + mise en page côte à côte, extraction domain/subfield + envoi au Worker
- `worker/worker.js` : endpoint `/topics` — accepte `domain`/`subfields`, deux branches de prompt

## Déploiement

Comme pour V4, le changement Worker nécessite `wrangler deploy` (depuis `worker/`) par l'utilisateur après implémentation — pas d'accès direct à son compte Cloudflare depuis cette session.

## Hors scope

- Pas de table de traduction pour les ~250 sous-disciplines OpenAlex (le modèle traduit à la volée)
- Pas de gestion d'un 5ème domaine OpenAlex hypothétique au-delà des 4 connus (`Health/Life/Physical/Social Sciences`) — si l'API en ajoute un jour, repli silencieux sur "domaine absent" (`DOMAIN_FR[...] || null`)
- Pas de re-génération automatique des résumés déjà en cache `sessionStorage` sous l'ancien format — comme en V4, seul un clic sur "Régénérer" applique le nouveau prompt
