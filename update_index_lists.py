#!/usr/bin/env python3
"""Reconstruit les deux listes d'indexation servies a cote d'index.html.

  wos_issns.json     ISSN -> "SCIE,SSCI"   (collections Web of Science)
  scopus_issns.json  ISSN -> "Active"      (statut Scopus)

Les deux fichiers ont la meme forme :

    {"generated_at", "source", "<base>_total", "corpus_total", "matched",
     "issns": {"0018-1005": "ESCI", ...}}

Le front (index.html) les charge dans window.WOS_MAP et window.SCOPUS_MAP et
s'en sert pour les filtres d'indexation du catalogue.

Les ISSN sont normalises en NNNN-NNNN.

Un seul script pour les deux bases : le corpus DOAJ africain n'est telecharge
qu'une fois, et il n'y a qu'un workflow a maintenir.

Usage :
    python update_index_lists.py                 # les deux listes
    python update_index_lists.py --only wos      # une seule
    python update_index_lists.py --self-check    # verifications internes
"""
import argparse
import csv
import io
import json
import re
import sys
import urllib.request
from datetime import date

RAW = "https://raw.githubusercontent.com/wosaide/wosaide-journal-lists/main/"
API = "https://api.github.com/repos/wosaide/wosaide-journal-lists/contents/"
SOURCE = "github.com/wosaide/wosaide-journal-lists"
CORPUS = "https://doaj-african-cache.ynnonazaline.workers.dev/csv"
UA = {"User-Agent": "doaj-african-observatory-index-sync/1.0"}

WOS_COLLECTIONS = ["AHCI", "ESCI", "SCIE", "SSCI"]

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def fetch(url, timeout=300):
    if not re.match(r"^https?://", url):
        with open(url, encoding="utf-8-sig") as f:
            return f.read()
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8-sig", "replace")


def norm(v):
    """'2053 1583' -> '2053-1583'. Rend '' si ce n'est pas un ISSN."""
    s = re.sub(r"[^0-9Xx]", "", v or "").upper()
    return s[:4] + "-" + s[4:] if len(s) == 8 else ""


def issns_of(row, keys):
    return [i for i in (norm(row.get(k, "")) for k in keys) if i]


def month_key(filename):
    """Ordonne 'ext_list_Jul_2026.csv' par (annee, mois). (0, 0) si illisible."""
    m = re.search(r"ext_list_([A-Za-z]+)_(\d{4})", filename or "")
    if not m:
        return (0, 0)
    return (int(m.group(2)), MONTHS.get(m.group(1)[:3].lower(), 0))


def newest_scopus_file():
    """Le dossier SCOPUS ne contient qu'un export, mais il est DATE : le figer
    dans le code reviendrait a ne jamais mettre la liste a jour. On interroge
    donc l'API GitHub et on prend le ext_list_*.csv le plus recent."""
    listing = json.loads(fetch(API + "SCOPUS"))
    names = [f["name"] for f in listing
             if f.get("type") == "file" and re.match(r"ext_list_.*\.csv$", f.get("name", ""))]
    if not names:
        raise RuntimeError("aucun ext_list_*.csv dans le dossier SCOPUS")
    best = max(names, key=month_key)
    if month_key(best) == (0, 0):
        raise RuntimeError("impossible de dater les exports Scopus : %s" % names)
    return best


def load_wos():
    """ISSN -> set(collections)."""
    wos = {}
    for col in WOS_COLLECTIONS:
        rows = list(csv.DictReader(io.StringIO(fetch(RAW + "WOS/" + col + ".csv"))))
        for row in rows:
            for issn in issns_of(row, ("ISSN", "eISSN")):
                wos.setdefault(issn, set()).add(col)
        print("  %s : %d revues" % (col, len(rows)), file=sys.stderr)
    return wos


def load_scopus():
    """ISSN -> {'Active'} ou {'Inactive'}."""
    name = newest_scopus_file()
    print("  export retenu : %s" % name, file=sys.stderr)
    rows = list(csv.DictReader(io.StringIO(fetch(RAW + "SCOPUS/" + name))))
    out = {}
    for row in rows:
        status = (row.get("Active or Inactive") or "").strip() or "Active"
        for issn in issns_of(row, ("ISSN", "EISSN")):
            # Active l'emporte : une revue peut figurer deux fois.
            if out.get(issn) != "Active":
                out[issn] = status
    print("  Scopus : %d revues, %d ISSN uniques" % (len(rows), len(out)), file=sys.stderr)
    return out, name


def load_corpus(src):
    """Le Worker renvoie du JSON, un fichier local du CSV : on accepte les deux."""
    text = fetch(src).lstrip()
    rows = json.loads(text) if text[:1] in "[{" else list(csv.DictReader(io.StringIO(text)))
    if isinstance(rows, dict):
        rows = rows.get("rows") or rows.get("journals") or []
    keys = [k for k in (rows[0] if rows else {}) if "issn" in k.lower()] or ["ISSN", "eISSN"]
    return rows, keys


def match(rows, keys, table, join):
    """Croise le corpus avec une table ISSN -> valeur(s). Renvoie (hits, revues)."""
    hits, journals = {}, 0
    for row in rows:
        found = {i: table[i] for i in issns_of(row, keys) if i in table}
        if not found:
            continue
        journals += 1
        value = join(found)
        for issn in found:
            hits[issn] = value
    return hits, journals


def write(path, payload):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default=CORPUS)
    ap.add_argument("--only", choices=["wos", "scopus"], help="ne produire qu'une liste")
    ap.add_argument("--wos-out", default="wos_issns.json")
    ap.add_argument("--scopus-out", default="scopus_issns.json")
    a = ap.parse_args()

    rows, keys = load_corpus(a.corpus)
    print("Corpus : %d revues (colonnes ISSN : %s)" % (len(rows), ", ".join(keys)), file=sys.stderr)

    if a.only != "scopus":
        print("Telechargement des listes Web of Science...", file=sys.stderr)
        wos = load_wos()
        hits, journals = match(rows, keys, wos,
                               lambda found: ",".join(sorted(set().union(*found.values()))))
        write(a.wos_out, {
            "generated_at": date.today().isoformat(),
            "source": SOURCE,
            "wos_total": len(wos),
            "corpus_total": len(rows),
            "matched": journals,
            "issns": dict(sorted(hits.items())),
        })
        print("-> %s : %d/%d revues du corpus dans le WOS (%d ISSN)"
              % (a.wos_out, journals, len(rows), len(hits)), file=sys.stderr)

    if a.only != "wos":
        print("Telechargement de la liste Scopus...", file=sys.stderr)
        scopus, name = load_scopus()
        hits, journals = match(rows, keys, scopus,
                               lambda found: "Active" if "Active" in found.values() else "Inactive")
        write(a.scopus_out, {
            "generated_at": date.today().isoformat(),
            "source": SOURCE + " (SCOPUS/" + name + ")",
            "scopus_total": len(scopus),
            "corpus_total": len(rows),
            "matched": journals,
            "issns": dict(sorted(hits.items())),
        })
        print("-> %s : %d/%d revues du corpus dans Scopus (%d ISSN)"
              % (a.scopus_out, journals, len(rows), len(hits)), file=sys.stderr)


def demo():
    """python update_index_lists.py --self-check"""
    assert norm("2649-664X") == "2649-664X"
    assert norm("2053 1583") == "2053-1583"
    assert norm("20531583") == "2053-1583"
    assert norm("") == "" and norm("abc") == ""
    assert issns_of({"ISSN": "0171-5410", "eISSN": ""}, ("ISSN", "eISSN")) == ["0171-5410"]

    # Le choix de l'export Scopus doit suivre la date, pas l'ordre alphabetique :
    # 'Jul_2026' est plus recent que 'Oct_2025', mais 'Jul' < 'Oct' en ASCII.
    names = ["ext_list_Oct_2025.csv", "ext_list_Jul_2026.csv", "ext_list_Feb_2026.csv"]
    assert max(names, key=month_key) == "ext_list_Jul_2026.csv"
    assert month_key("ext_list_Jul_2026.csv") == (2026, 7)
    assert month_key("README.md") == (0, 0)

    # Croisement : une revue connue par son EISSN compte une fois, et l'etat
    # Active l'emporte sur Inactive.
    rows = [{"ISSN": "1111-1111", "eISSN": "2222-2222"}, {"ISSN": "9999-9999", "eISSN": ""}]
    table = {"2222-2222": "Active", "1111-1111": "Inactive"}
    hits, journals = match(rows, ["ISSN", "eISSN"], table,
                           lambda f: "Active" if "Active" in f.values() else "Inactive")
    assert journals == 1, journals
    assert hits == {"1111-1111": "Active", "2222-2222": "Active"}, hits

    wos_table = {"1111-1111": {"SCIE"}, "2222-2222": {"SSCI", "AHCI"}}
    hits, journals = match(rows, ["ISSN", "eISSN"], wos_table,
                           lambda f: ",".join(sorted(set().union(*f.values()))))
    assert journals == 1
    assert hits["1111-1111"] == "AHCI,SCIE,SSCI", hits
    print("self-check OK")


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        demo()
    else:
        main()
