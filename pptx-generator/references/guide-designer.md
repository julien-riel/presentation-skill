# Guide Designer — Créer un gabarit .pptx compatible

Ce guide s'adresse aux designers qui souhaitent créer des gabarits PowerPoint (.pptx) personnalisés compatibles avec le skill pptx-generator. Il décrit les conventions de nommage des layouts, les placeholders requis, les contraintes de dimensions et les bonnes pratiques à respecter pour qu'un gabarit passe la validation.

---

## Noms des layouts

Le gabarit doit définir ses layouts dans le masque de diapositives (Slide Master) avec les noms exacts suivants :

| Nom du layout | Type | Description | Tier |
|---|---|---|---|
| `LAYOUT_TITLE` | title | Diapositive de titre | 1 |
| `LAYOUT_SECTION` | section | Séparateur de section | 1 |
| `LAYOUT_BULLETS` | bullets | Liste à puces | 1 |
| `LAYOUT_GENERIC` | generic | Contenu libre (fallback) | 1 |
| `LAYOUT_TWO_COLUMNS` | twoColumns | Deux colonnes | 2 |
| `LAYOUT_TIMELINE` | timeline | Frise chronologique | 2 |
| `LAYOUT_ARCHITECTURE` | architecture | Diagramme d'architecture | 3 |
| `LAYOUT_CHART` | chart | Graphique | 3 |
| `LAYOUT_TABLE` | table | Tableau | 3 |
| `LAYOUT_KPI` | kpi | Indicateurs clés | 3 |
| `LAYOUT_QUOTE` | quote | Citation | 3 |
| `LAYOUT_IMAGE_TEXT` | imageText | Image + texte | 3 |
| `LAYOUT_ROADMAP` | roadmap | Feuille de route | 3 |
| `LAYOUT_PROCESS` | process | Processus | 3 |
| `LAYOUT_COMPARISON` | comparison | Comparaison | 3 |

> Les noms sont sensibles à la casse. `Layout_Title` ou `layout_title` ne seront pas reconnus.

---

## Placeholders requis par layout

Chaque layout doit contenir des placeholders spécifiques, identifiés par leur type et leur index (`idx`).

### LAYOUT_TITLE

- `ctrTitle` (idx 0) — titre centré
- `subTitle` (idx 1) — sous-titre centré

### LAYOUT_SECTION

- `title` (idx 0)
- `body` (idx 1)

### LAYOUT_BULLETS

- `title` (idx 0)
- `body` (idx 1) — hauteur minimale : **2 286 000 EMU** (pour accueillir au moins 5 puces)

### LAYOUT_GENERIC

- `title` (idx 0)
- `body` (idx 1)

### LAYOUT_TWO_COLUMNS

- `title` (idx 0)
- `body` (idx 1) — colonne gauche
- `body` (idx 2) — colonne droite

Les deux colonnes ne doivent pas se chevaucher horizontalement.

### LAYOUT_TIMELINE

- `title` (idx 0)
- `body` (idx 1) — zone canvas, hauteur minimale : **60 % de la hauteur de la diapositive**

---

## Système de tiers

Les layouts sont organisés en trois tiers. Le validateur produit des diagnostics de sévérité différente selon le tier du layout manquant.

### Tier 1 — Minimum requis

Layouts : `LAYOUT_TITLE`, `LAYOUT_SECTION`, `LAYOUT_BULLETS`, `LAYOUT_GENERIC` (4 layouts).

Si l'un de ces layouts est absent, le validateur émet une **ERROR**. Le gabarit est considéré invalide.

### Tier 2 — Recommandé

Layouts : Tier 1 + `LAYOUT_TWO_COLUMNS`, `LAYOUT_TIMELINE`.

Si l'un de ces layouts est absent, le validateur émet un **WARNING**. Le gabarit reste utilisable mais certaines mises en page ne seront pas disponibles.

### Tier 3 — Complet

Tous les layouts avancés : `LAYOUT_ARCHITECTURE`, `LAYOUT_CHART`, `LAYOUT_TABLE`, `LAYOUT_KPI`, `LAYOUT_QUOTE`, `LAYOUT_IMAGE_TEXT`, `LAYOUT_ROADMAP`, `LAYOUT_PROCESS`, `LAYOUT_COMPARISON`.

L'absence de ces layouts n'est pas bloquante. Le validateur émet un **WARNING** pour les layouts individuels (ex: LAY-006 pour LAYOUT_ARCHITECTURE) et une **INFO** globale via TIER-003 si le Tier 3 n'est pas complet. Les diapositives concernées seront automatiquement dégradées via la cascade de fallback.

### Cascade de fallback

Lorsqu'un layout n'est pas disponible dans le gabarit, le générateur tente de le remplacer par un layout plus simple. Exemples de chaînes de dégradation :

- `kpi` → `bullets` → `generic`
- `architecture` → `bullets` → `generic`
- `chart` → `bullets` → `generic`
- `table` → `bullets` → `generic`
- `quote` → `bullets` → `generic`
- `comparison` → `twoColumns` → `bullets` → `generic`
- `roadmap` → `timeline` → `bullets` → `generic`
- `process` → `timeline` → `bullets` → `generic`
- `imageText` → `twoColumns` → `bullets` → `generic`

Le layout `LAYOUT_GENERIC` sert de fallback ultime. C'est pour cette raison qu'il fait partie du Tier 1.

---

## Contraintes de dimensions

- **Format** : 16:9 — soit **12 192 000 × 6 858 000 EMU**
- **Marges minimales** : 0.5 pouce (**457 200 EMU**) sur chaque côté (haut, bas, gauche, droite)
- Les placeholders ne doivent pas dépasser les marges

### Rappel des unités

1 pouce = 914 400 EMU (English Metric Units). PowerPoint utilise les EMU comme unité interne pour toutes les dimensions.

---

## Bonnes pratiques thème

### Contraste

Respecter le niveau WCAG AA : ratio de contraste **>= 4.5:1** entre le texte et le fond. Cela concerne en particulier :

- Le texte sur les fonds de diapositive
- Les titres sur les barres de couleur
- Le texte dans les formes colorées

### Polices

- Utiliser des polices lisibles : Calibri, Arial, Segoe UI, etc.
- Définir une **police titre** (`majorFont`) et une **police corps** (`minorFont`) distinctes dans le thème
- Éviter les polices décoratives pour le corps de texte

### Couleurs

- Définir **6 couleurs d'accent** dans le thème (`accent1` à `accent6`)
- S'assurer que chaque couleur d'accent offre un contraste suffisant avec le fond

---

## Validation du gabarit

Utilisez la CLI pour valider votre gabarit avant de le distribuer.

```bash
# Valider un gabarit
npx tsx src/cli.ts validate mon-gabarit.pptx

# Valider et générer une démo
npx tsx src/cli.ts validate mon-gabarit.pptx --demo

# Exporter le manifeste
npx tsx src/cli.ts validate mon-gabarit.pptx -o manifeste.json

# Sortie JSON
npx tsx src/cli.ts validate mon-gabarit.pptx --json
```

La commande `validate` vérifie :

1. Le format 16:9
2. La présence des layouts Tier 1
3. Les placeholders requis pour chaque layout détecté
4. Les contraintes de dimensions (marges, taille des placeholders)
5. La présence du thème (polices, couleurs)

---

## Erreurs courantes et solutions

| Code | Message | Cause | Solution |
|---|---|---|---|
| `LAY-001` | Layout name not recognized | Le nom du layout ne correspond pas à la convention `LAYOUT_*` | Renommer le layout dans le masque de diapositives pour qu'il corresponde exactement à l'un des noms listés ci-dessus |
| `PH-001` | Missing placeholder | Un placeholder requis est absent du layout | Ajouter le placeholder manquant avec le bon type et le bon index (voir section « Placeholders requis par layout ») |
| `DIM-001` | Wrong aspect ratio | La taille de la diapositive n'est pas en 16:9 | Dans PowerPoint : Conception → Taille des diapositives → Grand écran (16:9). Vérifier que les dimensions sont exactement 12 192 000 × 6 858 000 EMU |
| `THM-001` | Missing theme | Le gabarit ne contient pas de thème ou le thème est incomplet | Ajouter un thème avec au minimum : une police titre (`majorFont`), une police corps (`minorFont`) et 6 couleurs d'accent |
