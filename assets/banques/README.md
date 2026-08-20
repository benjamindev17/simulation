# Logos des banques

Logos actuellement en place :

| Fichier | Banque |
| --- | --- |
| `crelan.png` | Crelan |
| `kbc.png` | KBC |
| `cph.png` | CPH |
| `belfius.png` | Belfius |
| `beobank.png` | Beobank |

Le chemin de chaque fichier est déclaré dans le champ `logo` du registre, en haut
de `assets/js/banques.js`. Si un fichier est absent ou illisible, l'application
retombe d'elle-même sur une pastille aux initiales dans la couleur de l'enseigne —
aucune image cassée n'apparaît.

## Remplacer un logo

Déposer le nouveau fichier sous le même nom : rien d'autre à changer. Pour passer
d'un PNG à un SVG (plus net à l'agrandissement), adapter aussi l'extension dans le
champ `logo` du registre.

## Format

Le logo est affiché dans un rectangle d'environ 58 × 34 px, sur fond blanc, en
`object-fit: contain` : jamais déformé, seulement mis à l'échelle. Un rectangle
plutôt qu'un carré parce que la plupart de ces logos placent le nom sous ou à côté
du symbole — dans un carré, ils deviennent illisibles.

## Ajouter les fichiers depuis GitHub (fonctionne aussi depuis un téléphone)

1. Ouvrir le dépôt sur github.com, dossier `assets/banques/`.
2. **Add file → Upload files**.
3. Déposer les fichiers, puis **Commit changes**.

## Note

Ces logos sont des marques déposées, propriété de leurs titulaires respectifs.
Ils ne sont utilisés ici que pour identifier l'établissement à l'origine de
chaque simulation, dans un outil personnel — pas pour représenter ces
établissements ni laisser entendre qu'ils approuvent cet outil.
