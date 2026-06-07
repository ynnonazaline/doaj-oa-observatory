# Design — index-new.html : Observatoire mondial des revues OA

**Date :** 2026-06-07  
**Statut :** Approuvé  

---

## Objectif

Créer un fichier `index-new.html` autonome, inspiré du design de `index.html`, offrant :
1. Une carte choroplèthe mondiale visualisant le nombre de revues OA par pays (données DOAJ globales)
2. Un graphique du coût médian des APC par pays en euros

---

## Architecture générale

- SPA statique, aucun framework
- Stack : Leaflet, ECharts, PapaParse, Inter + Material Symbols, thème sombre/clair identique à `index.html`
- Fichier unique autonome

### Flux de données

1. Fetch CSV global DOAJ via `https://corsproxy.io/?url=https%3A%2F%2Fdoaj.org%2Fcsv%2Fjournals` (streaming PapaParse)
2. Si CORS échoue → modale fallback upload manuel CSV (pattern existant)
3. Fetch taux de change `https://open.er-api.com/v6/latest/EUR` pour conversion APC → EUR
4. Agrégation en mémoire par pays : `{ count: number, apc_eur: number[] }`
5. Render carte Leaflet + graphique ECharts

### Colonnes CSV DOAJ utilisées

| Colonne | Usage |
|---|---|
| `Journal title` | Liste revues dans le drawer |
| `Country of publisher` | Agrégation par pays |
| `Journal URL` | Lien dans le drawer |
| `APC` | Filtre Yes/No |
| `APC amount` | Valeur brute |
| `APC amount currency` | Conversion EUR |
| `Journal license` | Affiché dans le drawer |
| `ISSN` / `EISSN` | Affiché dans le drawer |

---

## Mise en page

### Header

- Titre : « Observatoire mondial des revues en libre accès »
- Compteur total (nb revues chargées)
- Toggle thème sombre/clair
- Lien retour vers `index.html`
- Lien « Données DOAJ » (comme index.html)

### Section 1 — Carte choroplèthe mondiale

**Librairie :** Leaflet.js (déjà utilisé dans index.html)  
**GeoJSON :** `https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson`  
- Propriété `name` = nom pays anglais, compatible noms DOAJ  
- Poids ~500KB  

**Coloration :**
- Échelle logarithmique, 5 paliers de couleur (bleu accent → bleu foncé)
- Pays sans revues DOAJ : gris neutre `var(--card-border)`
- Légende fixe en bas à gauche

**Interactions :**
- **Hover** → tooltip flottant : drapeau (flag-icons), pays, nb revues, médiane APC € (ou « Sans APC » si 0)
- **Clic** → drawer latéral droit (voir ci-dessous)

**Drawer latéral (panneau pays) :**
- S'ouvre en overlay à droite, largeur 360px, scrollable
- En-tête : drapeau + nom pays, nb revues, médiane APC €
- Liste des revues du pays : titre cliquable (lien DOAJ), ISSN, licence, APC amount si applicable
- Bouton fermer (×) en haut à droite
- Clic en dehors du drawer = fermeture

### Section 2 — Coût médian des APC par pays (€)

**Librairie :** ECharts  
**Type :** Bar chart horizontal, trié par médiane décroissante  
**Données :** Uniquement pays avec ≥ 1 revue ayant APC > 0 et currency convertible  
**Tooltip :** médiane €, nb revues avec APC, top 3 revues  
**Contrôle :** slider/select « Pays avec au moins N revues à APC » (valeurs : 1, 2, 5, 10)  
**Hauteur :** dynamique selon nb de pays (min 400px)

---

## Gestion des cas limites

| Cas | Comportement |
|---|---|
| Pays sans revues DOAJ | Gris sur la carte, absent du graphique APC |
| APC en devise non convertible | Exclu du calcul médiane, signalé « (devise inconnue) » en tooltip |
| Nom pays GeoJSON ≠ nom DOAJ | Table de mapping statique dans le JS |
| Timeout fetch CSV > 30s | Modale fallback upload manuel |
| Taux de change indisponible | APC affiché dans devise d'origine, médiane EUR masquée |

### Table de mapping pays (GeoJSON → DOAJ)

```js
const COUNTRY_NAME_MAP = {
  "United States of America": "United States",
  "South Korea": "Korea, Republic of",
  "North Korea": "Korea, Democratic People's Republic of",
  "Russia": "Russian Federation",
  "Iran": "Iran, Islamic Republic of",
  "Syria": "Syrian Arab Republic",
  "Tanzania": "Tanzania, United Republic of",
  "Venezuela": "Venezuela, Bolivarian Republic of",
  "Bolivia": "Bolivia, Plurinational State of",
  "Czech Republic": "Czechia",
  "Macedonia": "North Macedonia",
  "Moldova": "Moldova, Republic of",
  "Vietnam": "Viet Nam",
  "Laos": "Lao People's Democratic Republic",
  "Palestine": "Palestinian Territory, Occupied",
};
```

---

## Footer

- Crédit DOAJ (CC0) avec lien
- Crédit naturalearth (GeoJSON)
- Lien retour `index.html`
- Mention corsproxy.io
- Auteur : Innocent Azilan — CC BY 4.0

---

## Fichiers produits

- `index-new.html` — fichier unique autonome dans `DOAJ/OA/`

---

## Hors scope

- Recommandation de revues (spécifique à index.html)
- Intégration AJOL, Crossref, OpenAlex
- Filtres multi-critères avancés
- Export PDF/CSV
