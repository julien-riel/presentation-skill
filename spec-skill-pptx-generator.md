# Skill `pptx-generator` — Spécification technique

> **Version** : 1.0 — Mars 2026
> **Audience** : Équipe de développement
> **Statut** : Prêt pour implémentation

---

## 1. Vue d'ensemble

Le skill `pptx-generator` est un skill Claude qui génère des présentations PowerPoint professionnelles à partir de gabarits validés. Il couvre l'ensemble du cycle de vie :

1. **Validation de gabarit** — analyser un `.pptx` template, vérifier sa conformité, générer le manifeste de capacités et un PPTX démo.
2. **Génération de présentation** — transformer une entrée utilisateur (prompt libre, AST JSON, données structurées) en un fichier `.pptx` final via le pipeline AST → Transform → Renderer.

Le skill est déclenché quand l'utilisateur demande de créer une présentation, de valider un gabarit, ou de travailler avec le système de templates PPTX.

---

## 2. Modes d'opération

Le skill expose deux modes distincts. Le mode est déterminé automatiquement par le skill selon l'entrée utilisateur.

### 2.1 Mode Validation

**Déclencheurs** : l'utilisateur mentionne « valider un gabarit », « vérifier un template », uploade un `.pptx` en demandant de le valider, ou demande de générer un PPTX démo.

**Entrée** : un fichier `.pptx` (gabarit).

**Sorties** :
- Rapport de validation (texte ou JSON) avec résultats par règle.
- `template-capabilities.json` — manifeste de capacités.
- PPTX démo (optionnel, sur demande) — instancie chaque layout avec du contenu réaliste et des cas limites.

### 2.2 Mode Génération

**Déclencheurs** : l'utilisateur demande de créer une présentation, un deck, des slides, ou fournit un AST JSON / des données à transformer en présentation.

**Entrées supportées** :
- **Prompt texte libre** — le skill génère l'AST à partir du brief de l'utilisateur.
- **AST JSON** — le skill saute l'étape de parsing et passe directement au Transform.
- **Données structurées (CSV, JSON)** — le skill analyse les données et génère un AST adapté (slides KPI, charts, tableaux).

**Sortie** : un fichier `.pptx` prêt à l'emploi.

---

## 3. Architecture interne

```
┌─────────────────────────────────────────────────────────┐
│                    SKILL pptx-generator                 │
│                                                         │
│  ┌─────────┐   ┌───────────┐   ┌──────────┐            │
│  │  Parser  │──▶│ Transform │──▶│ Renderer │──▶ .pptx   │
│  └─────────┘   └───────────┘   └──────────┘            │
│       ▲              ▲               ▲                  │
│       │              │               │                  │
│   Entrée user   Manifeste de    Gabarit .pptx           │
│   (prompt,      capacités       (template)              │
│    AST, CSV)                                            │
│                                                         │
│  ┌────────────┐                                         │
│  │ Validateur │──▶ manifeste + rapport + démo           │
│  └────────────┘                                         │
│       ▲                                                 │
│       │                                                 │
│   Gabarit .pptx                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.1 Parser

Responsable de transformer l'entrée utilisateur en AST normalisé.

**Depuis un prompt texte libre** : le skill utilise Claude (LLM) pour analyser le brief et produire un AST JSON conforme au schéma. Le prompt système du parser doit inclure le schéma AST comme contrainte de sortie, les règles de design (max 5 bullets, max 12 mots par bullet), et les layouts disponibles selon le manifeste de capacités du gabarit actif. Le parser ne doit jamais demander un layout que le gabarit ne supporte pas, sauf si le fallback est acceptable.

**Depuis un AST JSON** : validation du schéma uniquement, pas de transformation.

**Depuis des données structurées** : analyse automatique des colonnes/clés pour choisir les layouts pertinents. Un CSV avec des métriques numériques → slides KPI ou chart. Un JSON hiérarchique → slides architecture ou bullets. Un CSV avec des dates → slide timeline.

### 3.2 Transform

Responsable de la validation et de l'adaptation de l'AST aux capacités du gabarit.

**Étapes, dans l'ordre** :

1. **Chargement du manifeste** — lire `template-capabilities.json` pour connaître les layouts disponibles, les tiers, et la matrice de fallback.

2. **Validation du schéma AST** — vérifier que l'AST est conforme (types, champs requis). Rejet si invalide.

3. **Résolution des layouts** — pour chaque slide, vérifier si le layout demandé existe dans `supported_layouts`. Si absent, appliquer la cascade de dégradation depuis `fallback_map`. Émettre un warning par dégradation.

4. **Dégradation des éléments** (`elementDegrader`) — quand un layout est dégradé, les éléments complexes sont convertis en éléments plus simples (ex : chart → table → bullets, kpi → bullets). Cela garantit que le contenu reste exploitable même sans le layout natif.

5. **Application des règles de contenu** :
   - Bullets > 5 par slide → auto-split en slides consécutives titrées « (1/N) », « (2/N) ».
   - Bullet > 12 mots → troncature + warning.
   - Titre > 2 lignes estimées (> ~60 caractères à 36pt) → troncature avec ellipse + warning.
   - Nœuds de diagramme > 8 → troncature aux 8 premiers nœuds, suppression des arêtes orphelines + warning.
   - Événements timeline > 6 → troncature aux 6 premiers événements + warning.
   - Indicateurs KPI > 6 → troncature aux 6 premiers + warning.
   - Lignes de tableau > 8 → troncature + warning. Colonnes > 6 → troncature + warning.
   - Catégories de chart > 8 → troncature + warning. Séries > 4 → troncature + warning.
   - Pie/donut avec multiples séries → réduction à une seule série.
   - Valeurs NaN/Infinity → remplacées par 0 + warning.

6. **Sortie** — AST enrichi avec les champs ajoutés : `_resolvedLayout` (layout effectif), `_splitIndex`, `_warnings[]`.

### 3.3 Renderer

Responsable de transformer l'AST enrichi en fichier `.pptx` physique.

**Principe** : le renderer est « stupide ». Il ne prend aucune décision de design. Il ouvre le gabarit, sélectionne le layout par nom, remplit les placeholders par index, et dessine des shapes pour les layouts canvas. Toute l'intelligence est dans le Transform.

**Opérations par type de layout** :

| Layout résolu      | Action du renderer                                              |
|---------------------|-----------------------------------------------------------------|
| title, section      | Remplir TITLE (idx 0) et SUBTITLE (idx 1) avec du texte        |
| bullets, generic    | Remplir TITLE (idx 0) avec texte, BODY (idx 1) avec puces      |
| twoColumns          | Remplir TITLE (idx 0), LEFT (idx 1), RIGHT (idx 2)             |
| timeline            | Remplir TITLE (idx 0), dessiner shapes dans CANVAS (idx 1)     |
| architecture        | Remplir TITLE (idx 0), dessiner shapes dans CANVAS (idx 1)     |
| kpi                 | Remplir TITLE (idx 0), dessiner cards KPI colorées dans CANVAS  |
| chart               | Remplir TITLE (idx 0), insérer chart OOXML natif (bar/line/pie/donut/stackedBar) |
| table               | Remplir TITLE (idx 0), dessiner tableau natif (header + lignes alternées) |
| quote               | Remplir TITLE (idx 0), texte citation centré + attribution      |
| roadmap             | Remplir TITLE (idx 0), dessiner barres de phases horizontales   |
| process             | Remplir TITLE (idx 0), dessiner boîtes numérotées + flèches    |
| comparison          | Remplir TITLE (idx 0), dessiner colonnes avec headers colorés   |
| imageText           | Remplir TITLE (idx 0), TEXT_BODY (idx 2). IMAGE (idx 1) réservé |

**Dessin de shapes (layouts canvas)** :

Pour les timelines — le renderer calcule l'espacement horizontal en fonction du nombre d'événements, dessine une ligne horizontale, des cercles colorés par statut (done=vert, in-progress=orange, planned=gris), et des labels alternés dessus/dessous.

Pour les diagrammes d'architecture — le renderer groupe les nœuds par `layer`, calcule l'espacement vertical entre couches, répartit les nœuds horizontalement dans chaque couche, dessine des rectangles arrondis pour les nœuds et des connecteurs fléchés pour les edges.

### 3.4 Validateur

Responsable de vérifier qu'un gabarit `.pptx` est utilisable par le renderer.

**Entrée** : un fichier `.pptx`.

**Sorties** :
- Rapport de validation (liste de résultats par règle).
- `template-capabilities.json` (manifeste).
- PPTX démo (optionnel).

#### Règles de validation

**Layouts (LAY-001 à LAY-010)**

| ID      | Sévérité | Règle                                                              |
|---------|----------|--------------------------------------------------------------------|
| LAY-001 | ERROR    | LAYOUT_TITLE doit exister                                          |
| LAY-002 | ERROR    | LAYOUT_SECTION doit exister                                        |
| LAY-003 | ERROR    | LAYOUT_BULLETS doit exister                                        |
| LAY-004 | WARNING  | LAYOUT_TWO_COLUMNS devrait exister (Tier 2)                        |
| LAY-005 | WARNING  | LAYOUT_TIMELINE devrait exister (Tier 2)                           |
| LAY-006 | WARNING  | LAYOUT_ARCHITECTURE devrait exister (Tier 3)                       |
| LAY-007 | ERROR    | LAYOUT_GENERIC doit exister                                        |
| LAY-008 | WARNING  | Aucun layout inattendu ne devrait être présent                     |
| LAY-009 | ERROR    | Aucun layout ne doit être dupliqué                                 |
| LAY-010 | WARNING  | Noms de layouts en ASCII uniquement (pas d'accents, pas d'espaces) |

Note : LAY-004, LAY-005, LAY-006 sont des warnings car ces layouts ne sont pas requis — le système dégrade automatiquement. Les layouts Tier 1 (LAY-001, LAY-002, LAY-003, LAY-007) sont des erreurs bloquantes.

**Placeholders (PH-001 à PH-015)**

| ID     | Sévérité | Règle                                                                        |
|--------|----------|------------------------------------------------------------------------------|
| PH-001 | ERROR    | LAYOUT_TITLE : placeholder Title à l'index 0                                |
| PH-002 | ERROR    | LAYOUT_TITLE : placeholder Subtitle/Text à l'index 1                        |
| PH-003 | ERROR    | LAYOUT_SECTION : placeholder Title à l'index 0                              |
| PH-004 | WARNING  | LAYOUT_SECTION : placeholder Subtitle/Text à l'index 1                      |
| PH-005 | ERROR    | LAYOUT_BULLETS : placeholder Title à l'index 0                              |
| PH-006 | ERROR    | LAYOUT_BULLETS : placeholder Content à l'index 1                            |
| PH-007 | ERROR    | LAYOUT_TWO_COLUMNS : placeholder Title à l'index 0                          |
| PH-008 | ERROR    | LAYOUT_TWO_COLUMNS : placeholder Content à l'index 1 (gauche)               |
| PH-009 | ERROR    | LAYOUT_TWO_COLUMNS : placeholder Content à l'index 2 (droite)               |
| PH-010 | ERROR    | LAYOUT_TIMELINE : placeholder Title à l'index 0                             |
| PH-011 | ERROR    | LAYOUT_TIMELINE : placeholder Content à l'index 1 (canvas)                  |
| PH-012 | ERROR    | LAYOUT_ARCHITECTURE : placeholder Title à l'index 0                         |
| PH-013 | ERROR    | LAYOUT_ARCHITECTURE : placeholder Content à l'index 1 (canvas)              |
| PH-014 | ERROR    | LAYOUT_GENERIC : placeholder Title à l'index 0                              |
| PH-015 | ERROR    | LAYOUT_GENERIC : placeholder Content à l'index 1                            |

Les règles PH-007 à PH-013 ne s'appliquent que si le layout correspondant existe dans le gabarit.

**Dimensions (DIM-001 à DIM-005)**

| ID      | Sévérité | Règle                                                                         |
|---------|----------|-------------------------------------------------------------------------------|
| DIM-001 | WARNING  | Ratio largeur/hauteur entre 1.7 et 1.8 (16:9)                                |
| DIM-002 | WARNING  | Placeholders à au moins 0.5 po des bords                                     |
| DIM-003 | WARNING  | BODY de LAYOUT_BULLETS : hauteur ≥ 2.5 po (2286000 EMU) pour 5 puces à 16pt |
| DIM-004 | WARNING  | LEFT et RIGHT de LAYOUT_TWO_COLUMNS ne se chevauchent pas                    |
| DIM-005 | WARNING  | Placeholders canvas occupent ≥ 60% de la hauteur de la slide                 |

**Thème (THM-001 à THM-004)**

| ID      | Sévérité | Règle                                                           |
|---------|----------|-----------------------------------------------------------------|
| THM-001 | WARNING  | Au moins 3 couleurs d'accent distinctes dans le thème           |
| THM-002 | WARNING  | Police de titre du thème définie (non vide)                     |
| THM-003 | WARNING  | Police de corps du thème définie (non vide)                     |
| THM-004 | WARNING  | Contraste Primary/fond suffisant (ratio WCAG AA ≥ 4.5:1)       |

**Tiers (TIER-001 à TIER-003)**

| ID       | Sévérité | Règle                                                          |
|----------|----------|----------------------------------------------------------------|
| TIER-001 | ERROR    | Le gabarit doit satisfaire le Tier 1 (title, section, bullets, generic) |
| TIER-002 | WARNING  | Layouts Tier 2 manquants (twoColumns, timeline)                |
| TIER-003 | INFO     | Layouts Tier 3+ manquants                                      |

**Manifeste (MAN-001 à MAN-002)**

| ID      | Sévérité | Règle                                                                   |
|---------|----------|-------------------------------------------------------------------------|
| MAN-001 | ERROR    | Le manifeste doit être généré avec succès                               |
| MAN-002 | ERROR    | Le fallback_map doit être cohérent (chaque cascade atteint `generic`)   |

---

## 4. Capacités de gabarit (Template Capabilities)

### 4.1 Principe

Le renderer supporte un catalogue croissant de layout types. Chaque gabarit n'en implémente qu'un sous-ensemble. Le validateur analyse le `.pptx` et produit un manifeste `template-capabilities.json` que le Transform consomme à runtime.

### 4.2 Catalogue des layouts

| Layout type    | Nom PPT                | Version | Placeholders                              |
|----------------|------------------------|---------|-------------------------------------------|
| title          | LAYOUT_TITLE           | V1      | TITLE(0), SUBTITLE(1)                     |
| section        | LAYOUT_SECTION         | V1      | TITLE(0), SUBTITLE(1)                     |
| bullets        | LAYOUT_BULLETS         | V1      | TITLE(0), BODY(1)                         |
| twoColumns     | LAYOUT_TWO_COLUMNS     | V1      | TITLE(0), LEFT(1), RIGHT(2)              |
| timeline       | LAYOUT_TIMELINE        | V1      | TITLE(0), CANVAS(1)                       |
| architecture   | LAYOUT_ARCHITECTURE    | V1      | TITLE(0), CANVAS(1)                       |
| generic        | LAYOUT_GENERIC         | V1      | TITLE(0), BODY(1)                         |
| chart          | LAYOUT_CHART           | V2      | TITLE(0), CHART_AREA(1)                   |
| table          | LAYOUT_TABLE           | V2      | TITLE(0), TABLE_AREA(1)                   |
| kpi            | LAYOUT_KPI             | V2      | TITLE(0), KPI_CANVAS(1)                   |
| quote          | LAYOUT_QUOTE           | V2      | TITLE(0), QUOTE_BODY(1), AUTHOR(2)        |
| imageText      | LAYOUT_IMAGE_TEXT      | V3      | TITLE(0), IMAGE(1), TEXT_BODY(2)          |
| roadmap        | LAYOUT_ROADMAP         | V3      | TITLE(0), ROADMAP_CANVAS(1)               |
| process        | LAYOUT_PROCESS         | V3      | TITLE(0), PROCESS_CANVAS(1)               |
| comparison     | LAYOUT_COMPARISON      | V3      | TITLE(0), LEFT(1), RIGHT(2), VS_LABEL(3) |

### 4.3 Tiers de capacité

Le validateur classe automatiquement chaque gabarit :

**Tier 1 — Minimal** (requis, absence = ERROR)
- `title`, `section`, `bullets`, `generic`

**Tier 2 — Standard** (recommandé, absence = WARNING)
- Tier 1 + `twoColumns`, `timeline`

**Tier 3 — Complet**
- Tier 2 + `architecture` + tous les layouts V2/V3 supportés par le renderer

Le tier assigné est le plus haut niveau **complètement satisfait**. Un gabarit Tier 2 qui a aussi `architecture` mais pas `chart` reste Tier 2 (car Tier 3 exige tout).

### 4.4 Matrice de dégradation

Quand le layout demandé est absent du gabarit, le Transform applique cette cascade. Si le fallback cible est lui-même absent, on descend au suivant jusqu'à `generic`.

```
kpi          → bullets      → generic
chart        → table        → bullets      → generic
table        → bullets      → generic
quote        → bullets      → generic
architecture → bullets      → generic
imageText    → twoColumns   → bullets   → generic
roadmap      → timeline     → bullets   → generic
process      → timeline     → bullets   → generic
comparison   → twoColumns   → bullets   → generic
```

Le Transform annote l'AST enrichi avec le champ `_resolvedLayout` (layout effectif) et ajoute un warning dans `_warnings[]` pour chaque dégradation.

### 4.5 Schéma du manifeste

```json
{
  "template": "executive-template.pptx",
  "generated_at": "2026-03-14T10:30:00Z",
  "validator_version": "1.0.0",
  "tier": 2,
  "supported_layouts": [
    "title", "section", "bullets", "twoColumns", "timeline", "generic"
  ],
  "unsupported_layouts": [
    "architecture", "chart", "table", "kpi", "quote",
    "imageText", "roadmap", "process", "comparison"
  ],
  "fallback_map": {
    "architecture": "bullets",
    "kpi": "bullets",
    "chart": "bullets",
    "table": "bullets",
    "quote": "bullets",
    "imageText": "twoColumns",
    "roadmap": "timeline",
    "process": "timeline",
    "comparison": "twoColumns"
  },
  "placeholders": {
    "LAYOUT_TITLE": { "CTRTITLE": 0, "SUBTITLE": 1 },
    "LAYOUT_SECTION": { "TITLE": 0, "BODY": 1 },
    "LAYOUT_BULLETS": { "TITLE": 0, "BODY": 1 },
    "LAYOUT_TWO_COLUMNS": { "TITLE": 0, "BODY_1": 1, "BODY_2": 2 },
    "LAYOUT_TIMELINE": { "TITLE": 0, "BODY": 1 },
    "LAYOUT_GENERIC": { "TITLE": 0, "BODY": 1 }
  },
  "theme": {
    "title_font": "Montserrat",
    "body_font": "Calibri",
    "accent_colors": ["#1E3A5F", "#2C7DA0", "#E76F51"]
  },
  "slide_dimensions": {
    "width_emu": 12192000,
    "height_emu": 6858000
  }
}
```

> Note : les clés de placeholder sont générées à partir du type OOXML en majuscules. Quand plusieurs placeholders partagent le même type dans un layout, un suffixe d'index est ajouté (ex : `BODY_1`, `BODY_2`).

---

## 5. Schéma AST

### 5.1 Structure racine

```typescript
interface Presentation {
  title: string;
  metadata?: {
    author?: string;
    date?: string;
    version?: string;
    audience?: string;
  };
  theme?: string;
  slides: Slide[];
}
```

### 5.2 Slide

```typescript
type LayoutType =
  | "title" | "section" | "bullets" | "twoColumns"
  | "timeline" | "architecture" | "generic"
  | "chart" | "table" | "kpi" | "quote"
  | "imageText" | "roadmap" | "process" | "comparison";

interface Slide {
  layout: LayoutType;
  elements: Element[];
  notes?: string;
  // Champs ajoutés par le Transform (préfixe _)
  _resolvedLayout?: LayoutType;
  _splitIndex?: string;        // ex: "(1/2)"
  _warnings?: string[];
}
```

### 5.3 Types d'éléments

```typescript
type Element =
  | TitleElement
  | SubtitleElement
  | TextElement
  | BulletsElement
  | DiagramElement
  | TimelineElement
  | ChartElement
  | TableElement
  | KpiElement
  | QuoteElement;

interface TitleElement    { type: "title"; text: string }
interface SubtitleElement { type: "subtitle"; text: string }
interface TextElement     { type: "text"; text: string }

interface BulletsElement  {
  type: "bullets";
  items: string[];
  icons?: string[];              // Noms d'icônes Lucide, un par puce
  column?: "left" | "right";
  level?: number;
}

interface DiagramElement {
  type: "diagram";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface TimelineElement {
  type: "timeline";
  events: TimelineEvent[];
}

interface ChartElement {
  type: "chart";
  chartType: "bar" | "line" | "pie" | "donut" | "stackedBar";
  data: {
    labels: string[];
    series: { name: string; values: number[] }[];
  };
  options?: {
    title?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    yAxisMin?: number;
    yAxisMax?: number;
    valueFormat?: "number" | "percent" | "currency";
    currencySymbol?: string;
    showDataLabels?: boolean;
    showLegend?: boolean;
    legendPosition?: "top" | "bottom" | "right" | "left";
    colors?: string[];              // Hex codes (6 chars, sans #)
    gridLines?: boolean;
  };
}

interface TableElement {
  type: "table";
  headers: string[];
  rows: string[][];
}

interface KpiElement {
  type: "kpi";
  indicators: {
    label: string;
    value: string;
    unit?: string;
    trend?: "up" | "down" | "stable";
    icon?: string;               // Nom d'icône Lucide optionnel
  }[];
}

interface QuoteElement {
  type: "quote";
  text: string;
  author?: string;
  icon?: string;                 // Icône Lucide décorative optionnelle
}
```

### 5.4 Sous-types diagram et timeline

```typescript
interface DiagramNode {
  id: string;
  label: string;
  layer?: string;
  style?: { fill?: string; border?: string; icon?: string };
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed" | "dotted";
}

interface TimelineEvent {
  date: string;
  label: string;
  status?: "done" | "in-progress" | "planned";
  icon?: string;                 // Nom d'icône Lucide optionnel
}
```

---

## 6. PPTX démo (généré par le validateur)

Quand le validateur reçoit l'option `--demo`, il génère un fichier PPTX utilisant le gabarit validé. Ce fichier sert de preuve visuelle.

### 6.1 Slides du démo

| #  | Layout             | Cas testé                | But                                      |
|----|--------------------|--------------------------|------------------------------------------|
| 1  | LAYOUT_TITLE       | Nominal                  | Rendu titre + sous-titre                 |
| 2  | LAYOUT_SECTION     | Nominal                  | Rendu section                            |
| 3  | LAYOUT_BULLETS     | 3 puces courtes          | Cas standard                             |
| 4  | LAYOUT_BULLETS     | 5 puces (max)            | Vérifier que 5 puces tiennent            |
| 5  | LAYOUT_BULLETS     | Texte trop long (25 mots/puce) | Tester l'overflow                  |
| 6  | LAYOUT_BULLETS     | Titre sur 2 lignes       | Tester le wrap du titre                  |
| 7  | LAYOUT_TWO_COLUMNS | Nominal                  | Alignement des colonnes                  |
| 8  | LAYOUT_TWO_COLUMNS | 5 puces vs 2 puces       | Colonnes déséquilibrées                  |
| 9  | LAYOUT_TIMELINE    | 4 événements             | Statuts mixtes (done/in-progress/planned)|
| 10 | LAYOUT_TIMELINE    | 6 événements (max)       | Cas limite                               |
| 11 | LAYOUT_ARCHITECTURE| 3 couches, 4 nœuds       | Architecture simple                      |
| 12 | LAYOUT_ARCHITECTURE| 3 couches, 8 nœuds (max) | Cas limite                               |
| 13 | LAYOUT_GENERIC     | Texte libre              | Vérifier le fallback texte               |
| 14 | LAYOUT_GENERIC     | Bullets en fallback      | Vérifier les puces dans le body          |
| 15 | Dégradation        | kpi → bullets            | Montrer le rendu dégradé KPI             |
| 16 | Dégradation        | architecture → generic   | Montrer le rendu dégradé architecture    |

Les slides 15-16 ne sont générées que si le layout cible est absent du gabarit (ce qui est attendu pour un gabarit Tier 1 ou Tier 2). Elles montrent concrètement au designer ce que verra l'utilisateur final quand le système dégrade.

Chaque slide du démo inclut une note de présentateur décrivant le cas testé.

---

## 7. Workflow du skill

### 7.1 Mode Validation

```
1. L'utilisateur uploade un .pptx et demande de le valider
2. Le skill lit le .pptx (extraction XML interne)
3. Extraction de la structure : layouts, placeholders (noms + index), thème
4. Exécution des règles de validation (LAY, PH, DIM, THM, TIER, MAN)
5. Calcul du tier de capacité
6. Génération du fallback_map en fonction des layouts présents
7. Écriture du template-capabilities.json
8. Rapport à l'utilisateur (texte lisible, avec erreurs/warnings)
9. Si demandé : génération du PPTX démo
10. Livraison des fichiers à l'utilisateur
```

### 7.2 Mode Génération depuis un prompt libre

```
1. L'utilisateur décrit ce qu'il veut ("Fais-moi une présentation sur X")
2. Le skill charge le manifeste du gabarit actif
3. Le skill construit un prompt pour le LLM incluant :
   - Le schéma AST comme format de sortie
   - La liste des layouts disponibles (depuis le manifeste)
   - Les règles de contenu (max bullets, max mots, etc.)
   - Le contexte de l'utilisateur
4. Le LLM produit un AST JSON
5. Le Transform valide et enrichit l'AST
   - Résolution des layouts (dégradation si nécessaire)
   - Application des règles de contenu (split, troncature)
   - Annotation avec _resolvedLayout, _warnings
6. Le Renderer ouvre le gabarit et génère le .pptx
7. Livraison du fichier à l'utilisateur
8. Si warnings : afficher un résumé des dégradations appliquées
```

### 7.3 Mode Génération depuis un AST JSON

```
1. L'utilisateur fournit un fichier AST JSON
2. Validation du schéma (rejet si invalide, avec erreurs explicites)
3. Étapes 5-8 du workflow 7.2
```

### 7.4 Mode Génération depuis des données structurées

```
1. L'utilisateur uploade un CSV ou JSON de données
2. Le skill analyse la structure des données :
   - Colonnes numériques avec labels courts → slide KPI
   - Colonnes numériques avec catégories → slide chart (bar/line)
   - Données tabulaires mixtes → slide table
   - Colonne date + colonne texte → slide timeline
   - Données hiérarchiques (parent/enfant) → slide architecture
3. Le skill construit un prompt pour le LLM incluant :
   - Le résumé des données
   - Les types de slides suggérés
   - Demande de produire un AST avec titre, narration, et mise en contexte
4. Étapes 4-8 du workflow 7.2
```

---

## 8. Gestion des gabarits

### 8.1 Gabarit par défaut

Le skill doit inclure un gabarit par défaut (Tier 2 minimum) utilisable sans configuration. Ce gabarit est stocké dans le répertoire du skill sous `assets/default-template.pptx` avec son manifeste `assets/default-capabilities.json`.

### 8.2 Gabarit personnalisé

L'utilisateur peut fournir son propre gabarit. Le skill doit alors :

1. Valider le gabarit automatiquement (mode validation implicite).
2. Générer le manifeste si absent ou périmé.
3. Utiliser le gabarit personnalisé pour la génération.
4. Informer l'utilisateur du tier détecté et des éventuelles limitations.

### 8.3 Stockage du manifeste

Le manifeste est stocké à côté du gabarit avec le même nom de base :
```
executive-template.pptx
executive-template.capabilities.json
```

Le manifeste est régénéré si le `.pptx` est plus récent (comparaison de dates de modification).

---

## 9. Stack technologique recommandée

| Composant              | Technologie                  | Justification                             |
|------------------------|------------------------------|-------------------------------------------|
| Runtime                | Node.js + TypeScript         | Cohérence avec l'écosystème existant      |
| Lecture PPTX (validation) | JSZip + xml2js            | Accès direct au XML du .pptx              |
| Génération PPTX        | JSZip + OOXML brut           | Création de slides avec OOXML brut        |
| Icônes                 | lucide-static + @resvg/resvg-js | Rendu d'icônes Lucide en images PNG    |
| Schéma AST             | Zod                          | Validation avec inférence de types TS     |
| CLI (validateur)       | Commander.js                 | Parsing des options --demo, --strict, etc.|
| Tests                  | Vitest                       | Rapide, compatible TypeScript             |

---

## 10. Structure du projet

```
pptx-generator/
├── SKILL.md                          # Point d'entrée du skill
├── assets/
│   ├── default-template.pptx         # Gabarit Tier 2 par défaut
│   └── default-capabilities.json     # Manifeste pré-généré
├── references/
│   ├── guide-designer.md             # Guide pour le designer de gabarit
│   └── ast-schema.md                 # Documentation du schéma AST
├── src/
│   ├── index.ts                      # Orchestrateur principal du skill
│   ├── schema/
│   │   ├── presentation.ts           # Types Zod du schéma AST
│   │   └── capabilities.ts           # Types Zod du manifeste
│   ├── parser/
│   │   ├── promptParser.ts           # Prompt libre → AST via LLM
│   │   ├── dataParser.ts             # CSV/JSON → AST via analyse + LLM
│   │   └── astValidator.ts           # Validation d'un AST fourni
│   ├── transform/
│   │   ├── layoutResolver.ts         # Résolution + dégradation des layouts
│   │   ├── elementDegrader.ts        # Conversion d'éléments dégradés (chart → table/bullets)
│   │   ├── contentValidator.ts       # Règles max bullets, mots, etc.
│   │   └── index.ts                  # Orchestrateur du transform
│   ├── renderer/
│   │   ├── pptxRenderer.ts           # Moteur principal (JSZip + OOXML brut)
│   │   ├── placeholderFiller.ts      # Remplissage texte par index
│   │   ├── timelineDrawer.ts         # Dessin de timelines (shapes)
│   │   ├── architectureDrawer.ts     # Dessin de diagrammes (shapes)
│   │   ├── kpiDrawer.ts              # Cards KPI colorées avec tendances
│   │   ├── tableDrawer.ts            # Tableau natif (header + alternance)
│   │   ├── roadmapDrawer.ts          # Barres de phases horizontales
│   │   ├── processDrawer.ts          # Boîtes numérotées + flèches
│   │   ├── comparisonDrawer.ts       # Colonnes avec headers colorés
│   │   ├── placeholderFiller.ts       # Remplissage placeholders, citation, icônes bullets
│   │   ├── chartDrawer.ts            # Orchestrateur charts OOXML
│   │   ├── charts/                   # Builders OOXML par type de chart
│   │   │   ├── barChartBuilder.ts    # Bar/stackedBar charts
│   │   │   ├── lineChartBuilder.ts   # Line charts avec marqueurs
│   │   │   ├── pieChartBuilder.ts    # Pie/donut charts
│   │   │   ├── chartXmlHelpers.ts    # Fragments XML réutilisables
│   │   │   └── chartStyleBuilder.ts  # Style/couleurs/rels boilerplate
│   │   ├── iconResolver.ts           # Résolution et rendu d'icônes Lucide
│   │   └── xmlHelpers.ts            # Utilitaires XML/OOXML (shapes, namespaces)
│   └── validator/
│       ├── templateReader.ts         # Extraction structure du .pptx
│       ├── rules/
│       │   ├── layoutRules.ts        # LAY-001 à LAY-010
│       │   ├── placeholderRules.ts   # PH-001 à PH-015
│       │   ├── dimensionRules.ts     # DIM-001 à DIM-005
│       │   ├── themeRules.ts         # THM-001 à THM-004
│       │   ├── tierRules.ts          # TIER-001 à TIER-003
│       │   ├── manifestRules.ts      # MAN-001 à MAN-002
│       │   ├── ruleHelpers.ts       # Utilitaires partagés des règles de validation
│       │   └── index.ts             # Registre des règles
│       ├── engine.ts                 # Exécution des règles
│       ├── manifestGenerator.ts      # Génération du JSON de capacités
│       ├── demoGenerator.ts          # Génération du PPTX démo
│       └── formatter.ts             # Sortie texte et JSON
├── tests/
│   ├── schema/                       # Tests du schéma Zod
│   ├── transform/                    # Tests de résolution, split, dégradation
│   ├── renderer/                     # Tests du PPTX généré (lecture + assertions)
│   ├── validator/                    # Tests des règles de validation
│   └── fixtures/                     # Gabarits de test (.pptx valides et invalides)
└── package.json
```

---

## 11. Critères d'acceptance

### 11.1 Validation

- [ ] Un gabarit Tier 1 complet passe la validation sans erreur.
- [ ] Un gabarit sans LAYOUT_BULLETS échoue avec LAY-003 et TIER-001.
- [ ] Le manifeste généré est un JSON valide conforme au schéma `capabilities.ts`.
- [ ] Le PPTX démo contient exactement le nombre de slides attendu.
- [ ] Les slides démo de dégradation montrent le bon layout résolu.

### 11.2 Génération depuis prompt libre

- [ ] Un prompt « Fais une présentation sur les défis du projet X » produit un .pptx avec au moins une slide titre et 2+ slides de contenu.
- [ ] Les puces ne dépassent jamais 5 par slide dans le PPTX final.
- [ ] Aucun layout absent du gabarit n'apparaît dans le PPTX final.
- [ ] Les dégradations sont reportées à l'utilisateur.

### 11.3 Génération depuis AST

- [ ] Un AST valide produit un .pptx identique à ce que décrit l'AST (mêmes titres, mêmes puces, mêmes layouts résolus).
- [ ] Un AST invalide (champ manquant, type incorrect) est rejeté avec un message d'erreur lisible.

### 11.4 Génération depuis données

- [ ] Un CSV avec colonnes numériques + labels produit au moins une slide KPI ou chart.
- [ ] Un CSV avec dates produit une slide timeline.

### 11.5 Dégradation

- [ ] Un AST demandant `kpi` sur un gabarit Tier 1 produit une slide `bullets` avec le contenu KPI en puces.
- [ ] Un AST demandant `roadmap` sur un gabarit sans `timeline` produit une slide `bullets`.
- [ ] La cascade `comparison` → `twoColumns` → `bullets` → `generic` fonctionne sur un gabarit Tier 1.
