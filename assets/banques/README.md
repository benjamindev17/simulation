# Logos des banques

Déposer ici le logo de chaque banque, **exactement sous ces noms** :

| Fichier attendu | Banque |
| --- | --- |
| `crelan.svg` | Crelan |
| `kbc.svg` | KBC |
| `cph.svg` | CPH |
| `belfius.svg` | Belfius |
| `beobank.svg` | Beobank |

Rien d'autre à faire : le fichier est repris automatiquement au chargement suivant.
Tant qu'un fichier manque, l'application retombe sur une pastille aux initiales
dans la couleur de l'enseigne — aucune image cassée n'apparaît.

## Format

- **SVG de préférence** (net à toutes les tailles). Le logo est affiché dans un
  carré d'environ 30 px de côté, sur fond blanc, en `object-fit: contain` :
  il n'est jamais déformé, seulement mis à l'échelle.
- **PNG accepté** : dans ce cas, renommer l'extension dans le champ `logo` du
  registre, en haut de `assets/js/banques.js`.
- Préférer la version compacte du logo (le symbole ou le monogramme) plutôt que le
  logo long avec la signature : dans un carré, un wordmark très horizontal devient
  minuscule.

## Ajouter les fichiers depuis GitHub (fonctionne aussi depuis un téléphone)

1. Ouvrir le dépôt sur github.com, dossier `assets/banques/`.
2. **Add file → Upload files**.
3. Déposer les fichiers, puis **Commit changes**.

## Note

Ces logos sont des marques déposées, propriété de leurs titulaires respectifs.
Ils ne sont utilisés ici que pour identifier l'établissement à l'origine de
chaque simulation, dans un outil personnel — pas pour représenter ces
établissements ni laisser entendre qu'ils approuvent cet outil.
