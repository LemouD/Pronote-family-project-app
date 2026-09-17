# Identite Familyo

Fichiers d'origine, gardes ici tels quels. Ils ne sont pas servis par le
Worker : le code ne lit rien dans ce dossier. Ils existent pour qu'on puisse
revenir a la source si le logo doit etre redessine, plutot que de dependre
d'une transcription.

| Fichier | Usage |
| --- | --- |
| `familyo-app-icon.svg` | Icone d'application : le symbole sur son carre Vert Foret. |
| `familyo-logo-full.svg` | Logo horizontal fond clair : le symbole sans carre, plus le mot "Familyo" vectorise. |

## Ce qui est reellement installe dans l'application

- `src/logo.ts` redessine l'icone d'application, aux memes coordonnees. C'est
  elle qui sert de favicon (`/favicon.svg`) et de vignette dans la barre
  laterale de l'espace parent.
- `tools/make-icons.ps1` regenere les quatre PNG de `src/assets/` a partir des
  memes coordonnees (icones 192 et 512, icone maskable, icone iOS).
- Le mot "Familyo" est ecrit en texte vivant (Lora 700), pas avec les traces
  vectorises du fichier : ceux-ci pesent 60 ko pour un seul mot.

## Palette

| Nom | Code | Role |
| --- | --- | --- |
| Vert Foret | `#1B5E4F` | Couleur institutionnelle : accent de l'espace parent, fond de l'icone, theme-color de la PWA. |
| Teal Energie | `#2AA399` | Couleur d'interaction. Presente dans le symbole ; l'accent du mode sombre (`#5CC4A6`) en descend. |
| Accent Corail | `#F17360` | Accentuation. Pour l'instant uniquement le point du logo. |
