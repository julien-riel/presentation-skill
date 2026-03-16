# Reference : Schema AST des presentations

## 1. Vue d'ensemble

L'AST (Abstract Syntax Tree) est la structure de donnees intermediaire qui
decrit une presentation. Il circule dans le pipeline selon trois etapes :

1. **Parser** -- transforme un prompt ou un fichier source en AST brut.
2. **Transform** -- valide le contenu, resout les layouts, gere les
   debordements (split de puces, troncature de titres) et annote l'AST avec
   des champs prefixes par `_`.
3. **Renderer** -- consomme l'AST final et produit un fichier PPTX via
   JSZip + OOXML brut.

L'AST est un objet JSON conforme au schema Zod defini dans
`src/schema/presentation.ts`. Ce document en est la reference exhaustive.

---

## 2. Structure racine (`Presentation`)

| Champ      | Type                          | Requis | Description                                      |
|------------|-------------------------------|--------|--------------------------------------------------|
| `title`    | `string`                      | oui    | Titre de la presentation                         |
| `metadata` | `PresentationMetadata`        | non    | Metadonnees (auteur, date, version, audience)    |
| `theme`    | `string`                      | non    | Nom du theme a appliquer                         |
| `slides`   | `Slide[]`                     | oui    | Liste ordonnee des diapositives                  |

### `PresentationMetadata`

| Champ      | Type     | Requis | Description                          |
|------------|----------|--------|--------------------------------------|
| `author`   | `string` | non    | Auteur de la presentation            |
| `date`     | `string` | non    | Date (format libre)                  |
| `version`  | `string` | non    | Numero de version                    |
| `audience` | `string` | non    | Public cible                         |

---

## 3. Structure d'une diapositive (`Slide`)

| Champ              | Type          | Requis | Description                                         |
|--------------------|---------------|--------|-----------------------------------------------------|
| `layout`           | `LayoutType`  | oui    | Type de mise en page demande                        |
| `elements`         | `Element[]`   | oui    | Liste des elements de contenu                       |
| `notes`            | `string`      | non    | Notes du presentateur (non affichees sur la diapo)  |
| `_resolvedLayout`  | `LayoutType`  | non    | Layout effectivement utilise apres resolution       |
| `_splitIndex`      | `string`      | non    | Indicateur de decoupage, ex. `"(1/2)"`              |
| `_warnings`        | `string[]`    | non    | Avertissements generes lors du transform            |

> Les champs prefixes par `_` sont ajoutes par le pipeline Transform et ne
> doivent pas etre fournis dans l'AST d'entree. Voir la section 6.

---

## 4. Types de layout

Le systeme supporte 15 types de layout :

| Layout         | Description                                        | Elements typiques                  |
|----------------|----------------------------------------------------|------------------------------------|
| `title`        | Diapositive de titre (couverture)                  | title, subtitle                    |
| `section`      | Separateur de section                              | title, subtitle                    |
| `bullets`      | Liste a puces                                      | title, bullets                     |
| `twoColumns`   | Deux colonnes cote a cote                          | title, bullets (left/right)        |
| `timeline`     | Frise chronologique                                | title, timeline                    |
| `architecture` | Diagramme d'architecture                           | title, diagram                     |
| `generic`      | Mise en page libre                                 | title, text, bullets               |
| `chart`        | Graphique (barres, lignes, camembert, donut)       | title, chart                       |
| `table`        | Tableau de donnees                                 | title, table                       |
| `kpi`          | Indicateurs cles de performance                    | title, kpi                         |
| `quote`        | Citation                                           | title, quote                       |
| `imageText`    | Image avec texte                                   | title, text                        |
| `roadmap`      | Feuille de route                                   | title, timeline                    |
| `process`      | Processus etape par etape                          | title, diagram                     |
| `comparison`   | Comparaison cote a cote                            | title, bullets (left/right)        |

> **Note :** Les layouts avances reutilisent les types d'elements d'autres layouts :
>
> | Layout avance  | Type d'element utilise | Equivalent                      |
> |----------------|------------------------|---------------------------------|
> | `imageText`    | `text`                 | Meme element que le layout `generic` |
> | `roadmap`      | `timeline`             | Meme element que le layout `timeline` |
> | `process`      | `diagram`              | Meme element que le layout `architecture` |
> | `comparison`   | `bullets`              | Meme element que le layout `twoColumns` (avec `label`) |

---

## 5. Types d'elements

Les elements forment une union discriminee sur le champ `type`.

### 5.1 `title`

Element de titre de la diapositive.

| Champ  | Type     | Requis | Description       |
|--------|----------|--------|-------------------|
| `type` | `"title"`| oui    | Discriminant      |
| `text` | `string` | oui    | Texte du titre    |

```json
{
  "type": "title",
  "text": "Bilan trimestriel Q3 2025"
}
```

### 5.2 `subtitle`

Sous-titre accompagnant le titre.

| Champ  | Type        | Requis | Description          |
|--------|-------------|--------|----------------------|
| `type` | `"subtitle"`| oui    | Discriminant         |
| `text` | `string`    | oui    | Texte du sous-titre  |

```json
{
  "type": "subtitle",
  "text": "Direction financiere"
}
```

### 5.3 `text`

Bloc de texte libre.

| Champ  | Type     | Requis | Description      |
|--------|----------|--------|------------------|
| `type` | `"text"` | oui    | Discriminant     |
| `text` | `string` | oui    | Contenu textuel  |

```json
{
  "type": "text",
  "text": "Ce rapport presente les resultats du troisieme trimestre."
}
```

### 5.4 `bullets`

Liste a puces. Peut etre affectee a une colonne dans un layout `twoColumns`.

| Champ    | Type                    | Requis | Description                                       |
|----------|-------------------------|--------|---------------------------------------------------|
| `type`   | `"bullets"`             | oui    | Discriminant                                      |
| `items`  | `string[]`              | oui    | Liste des puces                                   |
| `icons`  | `string[]`              | non    | Noms d'icones Lucide, un par puce                 |
| `column` | `"left"` \| `"right"`   | non    | Colonne cible (pour layout `twoColumns`)          |
| `label`  | `string`                | non    | Libelle d'en-tete (utilise par le layout `comparison`) |
| `level`  | `number`                | non    | Niveau d'indentation (0 = racine)                 |

```json
{
  "type": "bullets",
  "items": [
    "Chiffre d'affaires en hausse de 12%",
    "Nouveaux clients : 45",
    "Taux de retention : 94%"
  ],
  "icons": ["trending-up", "users", "shield-check"],
  "column": "left"
}
```

> **Comportement avec icones** : lorsque le champ `icons` est present et non vide,
> le renderer ne remplit **pas** le placeholder de puces du gabarit. Il genere a
> la place des textboxes explicites avec les images PNG des icones a cote de chaque
> puce. Cela signifie que le style de puces du gabarit (police, taille, couleur,
> indentation) n'est **pas applique** en mode icones. Le style est fixe : 14pt,
> aligne a gauche.

### 5.5 `diagram`

Diagramme de noeuds et d'aretes pour les layouts architecture/process.

| Champ   | Type             | Requis | Description                |
|---------|------------------|--------|----------------------------|
| `type`  | `"diagram"`      | oui    | Discriminant               |
| `nodes` | `DiagramNode[]`  | oui    | Liste des noeuds           |
| `edges` | `DiagramEdge[]`  | oui    | Liste des aretes           |

**`DiagramNode`**

| Champ   | Type     | Requis | Description                                |
|---------|----------|--------|--------------------------------------------|
| `id`    | `string` | oui    | Identifiant unique du noeud                |
| `label` | `string` | oui    | Libelle affiche                            |
| `layer` | `string` | non    | Couche logique (ex. `"frontend"`)          |
| `style` | `object` | non    | Style visuel : `fill`, `border`, `icon`    |

**`DiagramEdge`**

| Champ   | Type                                    | Requis | Description                    |
|---------|-----------------------------------------|--------|--------------------------------|
| `from`  | `string`                                | oui    | ID du noeud source             |
| `to`    | `string`                                | oui    | ID du noeud cible              |
| `label` | `string`                                | non    | Libelle de l'arete             |
| `style` | `"solid"` \| `"dashed"` \| `"dotted"`  | non    | Style de trait                 |

```json
{
  "type": "diagram",
  "nodes": [
    { "id": "web", "label": "App Web", "layer": "frontend", "style": { "fill": "#4A90D9" } },
    { "id": "api", "label": "API REST", "layer": "backend" },
    { "id": "db", "label": "PostgreSQL", "layer": "data", "style": { "icon": "database" } }
  ],
  "edges": [
    { "from": "web", "to": "api", "label": "HTTPS", "style": "solid" },
    { "from": "api", "to": "db", "style": "dashed" }
  ]
}
```

### 5.6 `timeline`

Frise chronologique avec evenements dates.

| Champ    | Type               | Requis | Description                |
|----------|--------------------|--------|----------------------------|
| `type`   | `"timeline"`       | oui    | Discriminant               |
| `events` | `TimelineEvent[]`  | oui    | Liste des evenements       |

**`TimelineEvent`**

| Champ    | Type                                           | Requis | Description               |
|----------|-------------------------------------------------|--------|---------------------------|
| `date`   | `string`                                        | oui    | Date de l'evenement       |
| `label`  | `string`                                        | oui    | Description               |
| `status` | `"done"` \| `"in-progress"` \| `"planned"`     | non    | Etat d'avancement         |
| `icon`   | `string`                                        | non    | Nom d'icone Lucide        |

```json
{
  "type": "timeline",
  "events": [
    { "date": "Jan 2025", "label": "Lancement du projet", "status": "done" },
    { "date": "Mar 2025", "label": "Version beta", "status": "in-progress" },
    { "date": "Jun 2025", "label": "Mise en production", "status": "planned" }
  ]
}
```

### 5.7 `chart`

Graphique de donnees.

| Champ       | Type                                                          | Requis | Description              |
|-------------|---------------------------------------------------------------|--------|--------------------------|
| `type`      | `"chart"`                                                     | oui    | Discriminant             |
| `chartType` | `"bar"` \| `"line"` \| `"pie"` \| `"donut"` \| `"stackedBar"` | oui    | Type de graphique        |
| `data`      | `ChartData`                                                   | oui    | Donnees du graphique     |
| `options`   | `ChartOptions`                                                | non    | Options de formatage     |

**`ChartData`**

| Champ    | Type             | Requis | Description                        |
|----------|------------------|--------|------------------------------------|
| `labels` | `string[]`       | oui    | Etiquettes de l'axe X / segments  |
| `series` | `ChartSeries[]`  | oui    | Series de donnees                  |

**`ChartSeries`**

| Champ    | Type       | Requis | Description              |
|----------|------------|--------|--------------------------|
| `name`   | `string`   | oui    | Nom de la serie          |
| `values` | `number[]` | oui    | Valeurs numeriques       |

**`ChartOptions`**

| Champ            | Type                                             | Requis | Description                                           |
|------------------|--------------------------------------------------|--------|-------------------------------------------------------|
| `title`          | `string`                                         | non    | Titre affiche au-dessus du graphique                  |
| `xAxisLabel`     | `string`                                         | non    | Libelle de l'axe X                                    |
| `yAxisLabel`     | `string`                                         | non    | Libelle de l'axe Y                                    |
| `yAxisMin`       | `number`                                         | non    | Valeur minimale de l'axe Y                            |
| `yAxisMax`       | `number`                                         | non    | Valeur maximale de l'axe Y                            |
| `valueFormat`    | `"number"` \| `"percent"` \| `"currency"`       | non    | Format des valeurs affichees                          |
| `currencySymbol` | `string`                                         | non    | Symbole monetaire (max 5 caracteres, pas de `<>&"'`)  |
| `showDataLabels` | `boolean`                                        | non    | Afficher les valeurs sur chaque point de donnees      |
| `showLegend`     | `boolean`                                        | non    | Afficher la legende                                   |
| `legendPosition` | `"top"` \| `"bottom"` \| `"right"` \| `"left"` | non    | Position de la legende                                |
| `colors`         | `string[]`                                       | non    | Couleurs hex 6 caracteres sans `#` (ex: `"4A90D9"`)  |
| `gridLines`      | `boolean`                                        | non    | Afficher les lignes de grille                         |

```json
{
  "type": "chart",
  "chartType": "bar",
  "data": {
    "labels": ["Q1", "Q2", "Q3", "Q4"],
    "series": [
      { "name": "2024", "values": [120, 150, 180, 200] },
      { "name": "2025", "values": [140, 170, 210, 240] }
    ]
  },
  "options": {
    "valueFormat": "currency",
    "currencySymbol": "€",
    "showDataLabels": true,
    "legendPosition": "bottom",
    "colors": ["4A90D9", "E76F51"],
    "gridLines": true
  }
}
```

### 5.8 `table`

Tableau de donnees.

| Champ     | Type         | Requis | Description                    |
|-----------|--------------|--------|--------------------------------|
| `type`    | `"table"`    | oui    | Discriminant                   |
| `headers` | `string[]`   | oui    | En-tetes de colonnes           |
| `rows`    | `string[][]` | oui    | Lignes (tableau de tableaux)   |

```json
{
  "type": "table",
  "headers": ["Produit", "CA Q3", "Variation"],
  "rows": [
    ["SaaS Pro", "1.2M EUR", "+15%"],
    ["SaaS Starter", "450K EUR", "+8%"],
    ["Services", "320K EUR", "-3%"]
  ]
}
```

### 5.9 `kpi`

Indicateurs cles de performance.

| Champ        | Type              | Requis | Description                   |
|--------------|-------------------|--------|-------------------------------|
| `type`       | `"kpi"`           | oui    | Discriminant                  |
| `indicators` | `KpiIndicator[]`  | oui    | Liste des indicateurs         |

**`KpiIndicator`**

| Champ   | Type                                       | Requis | Description              |
|---------|--------------------------------------------|--------|--------------------------|
| `label` | `string`                                   | oui    | Libelle de l'indicateur  |
| `value` | `string`                                   | oui    | Valeur affichee          |
| `unit`  | `string`                                   | non    | Unite (ex. `"%"`, `"EUR"`) |
| `trend` | `"up"` \| `"down"` \| `"stable"`          | non    | Tendance                 |
| `icon`  | `string`                                   | non    | Nom d'icone Lucide       |

```json
{
  "type": "kpi",
  "indicators": [
    { "label": "Chiffre d'affaires", "value": "2.1M", "unit": "EUR", "trend": "up" },
    { "label": "Marge nette", "value": "18", "unit": "%", "trend": "stable" },
    { "label": "NPS", "value": "72", "trend": "up" }
  ]
}
```

### 5.10 `quote`

Citation avec attribution optionnelle.

| Champ    | Type       | Requis | Description          |
|----------|------------|--------|----------------------|
| `type`   | `"quote"`  | oui    | Discriminant         |
| `text`   | `string`   | oui    | Texte de la citation |
| `author` | `string`   | non    | Auteur               |
| `icon`   | `string`   | non    | Icone Lucide decorative |

```json
{
  "type": "quote",
  "text": "L'innovation distingue un leader d'un suiveur.",
  "author": "Steve Jobs"
}
```

### 5.11 `image`

Image utilisateur embarquee dans la diapositive. Le fichier est lu depuis
le chemin fourni et insere dans le PPTX au moment du rendu.

| Champ     | Type       | Requis | Description                                    |
|-----------|------------|--------|------------------------------------------------|
| `type`    | `"image"`  | oui    | Discriminant                                   |
| `path`    | `string`   | oui    | Chemin absolu ou relatif vers le fichier image |
| `altText` | `string`   | non    | Texte alternatif (accessibilite)               |

Formats supportes : PNG, JPEG, GIF, SVG.

```json
{
  "type": "image",
  "path": "/tmp/uploads/photo.png",
  "altText": "Photo de l'equipe"
}
```

> **Positionnement** : sur un layout `imageText`, l'image est placee dans la
> moitie gauche de la diapositive. Sur les autres layouts (`bullets`, `generic`,
> etc.), elle occupe la zone de contenu principale. Si le fichier est introuvable
> au moment du rendu, un avertissement est emis et l'image est ignoree.

---

## 6. Champs ajoutes par le Transform

Ces champs sont annotes automatiquement par le pipeline Transform. Ils ne
doivent **jamais** etre fournis dans l'AST d'entree.

| Champ               | Type        | Description                                                                 |
|---------------------|-------------|-----------------------------------------------------------------------------|
| `_resolvedLayout`   | `LayoutType`| Layout effectivement utilise apres resolution. Si le gabarit ne supporte pas le layout demande, un layout de repli est choisi et inscrit ici. |
| `_warnings`         | `string[]`  | Liste des avertissements generes (troncatures, splits, layouts non supportes). |
| `_splitIndex`       | `string`    | Marqueur de decoupage au format `"(n/N)"` quand une liste de puces depasse la limite et est repartie sur plusieurs diapositives. |

---

## 7. Regles de contenu

Le Transform applique les regles suivantes :

| Regle                          | Seuil          | Action                                                        |
|--------------------------------|----------------|---------------------------------------------------------------|
| Puces par diapositive          | max 5          | Decoupage automatique en N diapositives avec suffixe `(n/N)`  |
| Mots par puce                  | max 12         | Troncature avec ellipse `…` et ajout d'un warning             |
| Caracteres par titre           | max ~60        | Troncature avec ellipse et ajout d'un warning                 |
| Indicateurs KPI                | max 6          | Troncature aux 6 premiers + warning                           |
| Lignes de tableau              | max 8          | Troncature aux 8 premieres lignes + warning                   |
| Colonnes de tableau            | max 6          | Troncature aux 6 premieres colonnes + warning                 |
| Categories de chart            | max 8          | Troncature aux 8 premieres + warning                          |
| Series de chart                | max 4          | Troncature aux 4 premieres series + warning                   |
| Noeuds de diagramme            | max 8          | Troncature aux 8 premiers, aretes orphelines supprimees       |
| Evenements timeline            | max 6          | Troncature aux 6 premiers + warning                           |
| Charts par diapositive         | max 1          | Seul le premier element chart est conserve                     |
| Pie/donut multi-series         | max 1 serie    | Reduction a la premiere serie + warning                        |
| Valeurs NaN/Infinity           | —              | Remplacees par 0 + warning                                    |

Chaque diapositive devrait contenir au moins un element `title` pour un rendu
coherent.

---

## 8. Exemple complet

Voici un AST complet de presentation avec 6 diapositives utilisant differents
layouts :

```json
{
  "title": "Bilan et perspectives 2025",
  "metadata": {
    "author": "Marie Dupont",
    "date": "2025-09-15",
    "version": "1.0",
    "audience": "Comite de direction"
  },
  "theme": "corporate",
  "slides": [
    {
      "layout": "title",
      "elements": [
        { "type": "title", "text": "Bilan et perspectives 2025" },
        { "type": "subtitle", "text": "Comite de direction -- Septembre 2025" }
      ],
      "notes": "Diapositive d'ouverture, remercier les participants."
    },
    {
      "layout": "bullets",
      "elements": [
        { "type": "title", "text": "Points cles du trimestre" },
        {
          "type": "bullets",
          "items": [
            "Chiffre d'affaires en hausse de 12%",
            "45 nouveaux clients signes",
            "Taux de retention a 94%",
            "Lancement de 2 nouveaux produits"
          ]
        }
      ]
    },
    {
      "layout": "kpi",
      "elements": [
        { "type": "title", "text": "Indicateurs cles" },
        {
          "type": "kpi",
          "indicators": [
            { "label": "CA cumule", "value": "6.3M", "unit": "EUR", "trend": "up" },
            { "label": "Marge brute", "value": "42", "unit": "%", "trend": "up" },
            { "label": "NPS", "value": "72", "trend": "stable" },
            { "label": "Effectif", "value": "128", "trend": "up" }
          ]
        }
      ]
    },
    {
      "layout": "chart",
      "elements": [
        { "type": "title", "text": "Evolution du chiffre d'affaires" },
        {
          "type": "chart",
          "chartType": "bar",
          "data": {
            "labels": ["Q1", "Q2", "Q3"],
            "series": [
              { "name": "2024", "values": [1800, 2100, 2200] },
              { "name": "2025", "values": [2000, 2300, 2500] }
            ]
          }
        }
      ],
      "notes": "Mettre en avant la progression Q3 vs Q3 N-1."
    },
    {
      "layout": "timeline",
      "elements": [
        { "type": "title", "text": "Feuille de route produit" },
        {
          "type": "timeline",
          "events": [
            { "date": "Jan 2025", "label": "Refonte UX v2", "status": "done" },
            { "date": "Avr 2025", "label": "API partenaires", "status": "done" },
            { "date": "Sep 2025", "label": "Module IA", "status": "in-progress" },
            { "date": "Dec 2025", "label": "App mobile", "status": "planned" }
          ]
        }
      ]
    },
    {
      "layout": "quote",
      "elements": [
        { "type": "title", "text": "Pour conclure" },
        {
          "type": "quote",
          "text": "Le meilleur moyen de predire l'avenir, c'est de le creer.",
          "author": "Peter Drucker"
        }
      ]
    }
  ]
}
```
