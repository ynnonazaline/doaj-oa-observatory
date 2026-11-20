/**
 * Verification des formats de citation extraits d'index1.html.
 *   node test_biblio.js
 *
 * Le bloc <script id="biblio-export-js"> est evalue tel quel, avec juste
 * assez de DOM pour qu'il se charge. On n'y teste que la mise en forme :
 * c'est la seule logique du bloc qui puisse se tromper en silence.
 */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(require('path').join(__dirname, 'index1.html'), 'utf8');
const code = html.match(/<script id="biblio-export-js">([\s\S]*?)<\/script>/);
assert(code, 'bloc biblio-export-js introuvable dans index1.html');

const noop = () => {};
const stubEl = { style: {}, addEventListener: noop, classList: { toggle: noop }, setAttribute: noop, textContent: '', innerHTML: '', childNodes: [], appendChild: noop, querySelector: () => stubEl };
const sandbox = {
  document: { readyState: 'complete', addEventListener: noop, getElementById: () => null, querySelectorAll: () => [], createElement: () => stubEl },
  localStorage: { getItem: () => null, setItem: noop },
  navigator: {},
  setTimeout: noop,
  confirm: () => false,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code[1], sandbox);

const B = sandbox.window.BIBLIO;
assert(B, 'window.BIBLIO non expose');

// Notice reelle (OpenAlex, forme abregee).
const work = {
  id: 'https://openalex.org/W1',
  doi: 'https://doi.org/10.1234/abcd.2026.9.4',
  title: 'De la détresse financière à la défaillance encastrée',
  publication_year: 2026,
  publication_date: '2026-04-02',
  language: 'fr',
  type: 'article',
  authorships: [
    { author: { display_name: 'Moïse Muka' } },
    { author: { display_name: 'Awa Ndiaye Diop' } },
  ],
  biblio: { volume: '9', issue: '4', first_page: '112', last_page: '137' },
  primary_location: {
    source: {
      display_name: 'Revue Internationale des Sciences de Gestion',
      host_organization_name: 'ASI',
      issn_l: '2665-7473',
    },
  },
};

const r = B.toRef(work);
assert.strictEqual(r.doi, '10.1234/abcd.2026.9.4', 'le prefixe doi.org doit tomber');
assert.strictEqual(r.url, 'https://doi.org/10.1234/abcd.2026.9.4');
assert.deepStrictEqual(r.authors, ['Moïse Muka', 'Awa Ndiaye Diop']);

const apa = B.format('APA 7', r);
assert.match(apa, /^Muka, M\., & Diop, A\. N\. \(2026\)\./, 'APA : nom puis initiales, esperluette\n' + apa);
assert.match(apa, /, 9\(4\), 112-137\./, 'APA : volume\(numero\), pages\n' + apa);

const mla = B.format('MLA 9', r);
assert.match(mla, /^Muka, Moïse, and Awa Ndiaye Diop\./, 'MLA : seul le premier auteur est inverse\n' + mla);
assert.match(mla, /vol\. 9, no\. 4, 2026, pp\. 112-137\./, 'MLA : pagination\n' + mla);

const chi = B.format('Chicago', r);
assert.match(chi, /^Muka, Moïse, and Awa Ndiaye Diop\. 2026\./, 'Chicago : auteur-date\n' + chi);
assert.match(chi, /9 \(4\): 112-137\./, 'Chicago : volume (numero): pages\n' + chi);

const iso = B.format('ISO 690', r);
assert.match(iso, /^MUKA, Moïse; DIOP, Awa Ndiaye\./, 'ISO 690 : noms en capitales\n' + iso);
assert.match(iso, /ISSN 2665-7473\./, 'ISO 690 : ISSN\n' + iso);

const bib = B.bibtex(r);
assert.match(bib, /^@article\{muka2026/, 'BibTeX : cle auteur+annee+mot\n' + bib);
assert.match(bib, /author\s+= \{Moïse Muka and Awa Ndiaye Diop\}/, 'BibTeX : auteurs joints par « and »\n' + bib);
assert.match(bib, /pages\s+= \{112--137\}/, 'BibTeX : tiret demi-cadratin\n' + bib);
assert.strictEqual((bib.match(/\{\{/g) || []).length, 1, 'BibTeX : seul le titre est double-accolade\n' + bib);

const ris = B.ris(r);
assert(ris.startsWith('TY  - JOUR\r\n'), 'RIS : type en tete');
assert(ris.includes('AU  - Muka, Moïse\r\nAU  - Diop, Awa Ndiaye'), 'RIS : une ligne AU par auteur\n' + ris);
assert(ris.includes('SP  - 112\r\nEP  - 137'), 'RIS : pages separees\n' + ris);
assert(ris.trimEnd().endsWith('ER  -'), 'RIS : fin d\'enregistrement');

// Cas limites : aucun auteur, pas de DOI, pas de pagination.
const bare = B.toRef({ id: 'https://openalex.org/W2', title: 'Note brève', publication_year: null });
const apaBare = B.format('APA 7', bare);
assert.match(apaBare, /^\(s\.d\.\)\. Note brève\./, 'APA sans auteur ni annee\n' + apaBare);
assert.strictEqual(bare.url, 'https://openalex.org/W2', 'sans DOI, on retombe sur l\'URL OpenAlex');
assert(B.ris(bare).includes('TI  - Note brève'), 'RIS minimal');

// Un seul auteur : MLA ne doit pas produire « and » orphelin.
const solo = B.toRef({ id: 'W3', title: 'Seul', publication_year: 2020, authorships: [{ author: { display_name: 'Kofi Mensah' } }] });
assert.match(B.format('MLA 9', solo), /^Mensah, Kofi\. "Seul\." 2020\./, B.format('MLA 9', solo));

// Trois auteurs ou plus : « et al. » en MLA, liste complete en APA.
const trio = B.toRef({ id: 'W4', title: 'Trois', publication_year: 2021, authorships:
  ['A Uno', 'B Dos', 'C Tres'].map(n => ({ author: { display_name: n } })) });
assert.match(B.format('MLA 9', trio), /^Uno, A, et al\./, B.format('MLA 9', trio));
assert.match(B.format('APA 7', trio), /^Uno, A\., Dos, B\., & Tres, C\./, B.format('APA 7', trio));

// Le CSV doit echapper les virgules du titre.
const csv = B.csv([B.toRef({ id: 'W5', title: 'Titre, avec virgule', publication_year: 2019 })]);
assert(csv.includes('"Titre, avec virgule"'), 'CSV : titre entoure de guillemets\n' + csv);

console.log('OK — 5 formats, RIS, BibTeX, CSV et cas limites');
