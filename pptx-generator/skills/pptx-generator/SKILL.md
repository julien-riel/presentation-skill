---
name: pptx-generator
description: Generate professional PowerPoint presentations from prompts, AST, or data, with template validation
---

# pptx-generator

Generateur de presentations PowerPoint professionnelles a partir de prompts, d'AST JSON ou de donnees, avec validation de gabarits.

## Declencheurs / Quand activer ce skill

Activer ce skill lorsque l'utilisateur :
- Mentionne : presentation, deck, slides, PowerPoint, PPTX, gabarit, template
- Mentionne en francais : creer une presentation, generer un deck, valider un gabarit
- Demande de creer un diaporama, generer des slides, ou valider un fichier .pptx

Mots-cles : `presentation`, `deck`, `slides`, `PowerPoint`, `PPTX`, `valider un gabarit`, `validate template`

## Mode 1 : Prompt libre (generation a partir de texte libre)

Quand l'utilisateur decrit une presentation en langage naturel :

1. **Charger le manifeste par defaut** : lire le fichier `assets/default-capabilities.json` s'il existe, sinon generer le manifeste en validant le gabarit par defaut :
   ```typescript
   import { readTemplate } from './src/validator/templateReader.js';
   import { generateManifest } from './src/validator/manifestGenerator.js';
   const template = await readTemplate('assets/default-template.pptx');
   const manifest = generateManifest(template, 'default-template.pptx');
   ```

2. **Construire le prompt systeme** : utiliser `buildASTPrompt(manifest, briefUtilisateur)` depuis `src/parser/promptParser.ts` pour obtenir les instructions de generation d'AST.

3. **Generer l'AST JSON** : toi-meme (Claude), tu generes le JSON AST en suivant le schema decrit dans le prompt. Le JSON doit respecter le schema `Presentation` defini dans `src/schema/presentation.ts`.

4. **Valider et generer** : passer l'AST a la chaine de transformation et rendu :
   ```typescript
   import { validateAST } from './src/parser/astValidator.js';
   import { transformPresentation } from './src/transform/index.js';
   import { renderToBuffer } from './src/renderer/pptxRenderer.js';

   const result = validateAST(astJson);
   const enriched = transformPresentation(result.data, manifest);
   const buffer = await renderToBuffer(enriched, 'assets/default-template.pptx');
   ```

5. **Sauvegarder** : ecrire le Buffer resultant dans un fichier `.pptx`.

6. **Rapporter les avertissements** : verifier `enriched.slides.flatMap(s => s._warnings ?? [])` et informer l'utilisateur des eventuels avertissements (layouts degrades, contenu tronque, etc.).

## Mode 2 : Entree AST JSON

Quand l'utilisateur fournit ou reference un fichier AST JSON :

1. Lire le fichier JSON.
2. Valider avec `validateAST(raw)` depuis `src/parser/astValidator.ts`.
3. Transformer et generer :
   ```typescript
   const enriched = transformPresentation(result.data, manifest);
   const buffer = await renderToBuffer(enriched, templatePath);
   ```
4. Sauvegarder le fichier `.pptx` resultant.

**Via CLI** :
```bash
npx tsx src/cli.ts generate --ast <chemin/ast.json> [-o sortie.pptx] [--template gabarit.pptx]
```

## Mode 3 : Entree de donnees (CSV/JSON)

Quand l'utilisateur fournit un fichier CSV ou JSON de donnees :

1. Lire le fichier de donnees.
2. Parser avec le bon format :
   ```typescript
   import { parseCSV, parseJSONData } from './src/parser/dataParser.js';
   const presentation = ext === '.csv' ? parseCSV(raw, titre) : parseJSONData(data, titre);
   ```
3. Valider, transformer et generer comme en Mode 2.

**Via CLI** :
```bash
npx tsx src/cli.ts generate --data <chemin/donnees.csv> --title "Mon titre" [-o sortie.pptx]
```

## Mode 4 : Validation de gabarit

Quand l'utilisateur veut valider un gabarit PowerPoint :

**Via CLI** :
```bash
npx tsx src/cli.ts validate <gabarit.pptx> [--json] [--demo] [-o manifeste.json]
```

**Par programmation** :
```typescript
import { readTemplate } from './src/validator/templateReader.js';
import { runValidation } from './src/validator/engine.js';
import { generateManifest } from './src/validator/manifestGenerator.js';
import { generateDemo } from './src/validator/demoGenerator.js';

const template = await readTemplate(cheminGabarit);
const results = runValidation(template);
const manifest = generateManifest(template, nomGabarit);
const demoBuffer = await generateDemo(manifest, cheminGabarit); // optionnel
```

**Sortie** :
- Rapport de validation (erreurs et avertissements)
- Manifeste des capacites (layouts supportes, placeholders, theme, dimensions)
- PPTX de demo optionnel (avec `--demo`) montrant chaque layout du gabarit

## Gabarits personnalises

L'utilisateur peut fournir son propre gabarit `.pptx` :
- Passer `templatePath` (ou `--template` en CLI) a toute fonction de generation
- Sans gabarit explicite, le gabarit par defaut (`assets/default-template.pptx`) est utilise
- Consulter `references/guide-designer.md` pour les regles de creation de gabarit

## Reference rapide du schema AST

### Structure globale

```json
{
  "title": "Titre de la presentation",
  "metadata": { "author": "Auteur", "date": "2026-03-14" },
  "slides": [ ... ]
}
```

### Types de layout

**Layouts natifs (gabarit par defaut Tier 2)** : `title`, `section`, `bullets`, `generic`, `twoColumns`, `timeline`

**Layouts avances (degrades via cascade de fallback)** : `architecture`, `chart`, `table`, `kpi`, `quote`, `imageText`, `roadmap`, `process`, `comparison`

### Types d'elements

| Type | Description | Proprietes principales |
|------|-------------|----------------------|
| `title` | Titre de la diapositive | `text` |
| `subtitle` | Sous-titre | `text` |
| `text` | Texte libre | `text` |
| `bullets` | Liste a puces | `items`, `column?` (left/right) |
| `timeline` | Frise chronologique | `events` (date, label, status?) |
| `diagram` | Diagramme d'architecture | `nodes` (id, label, layer?), `edges` (from, to) |
| `chart` | Graphique | `chartType` (bar/line/pie/donut), `data` |
| `table` | Tableau | `headers`, `rows` |
| `kpi` | Indicateurs cles | `indicators` (label, value, unit?, trend?) |
| `quote` | Citation | `text`, `author?` |

### Regles de contenu (strictes)

- **Maximum 5 puces par diapositive** — creer plusieurs slides si besoin
- **Maximum 12 mots par puce** — etre concis
- **Titre < 60 caracteres** environ
- Chaque diapositive DOIT avoir un element `title`
- Commencer par un layout `title`, terminer par une diapositive de cloture
- Viser 5 a 12 diapositives selon la profondeur du contenu

Le depassement de ces limites declenche un decoupage automatique (auto-split) avec avertissements.

## Exemples

### "Cree une presentation sur les resultats Q1"
→ **Mode 1 (Prompt libre)** : charger le manifeste, construire le prompt avec le brief utilisateur, generer l'AST JSON, puis transformer et rendre en .pptx.

### "Valide ce gabarit PowerPoint"
→ **Mode 4 (Validation)** : executer `npx tsx src/cli.ts validate <gabarit.pptx> --json --demo` pour obtenir le rapport de validation, le manifeste et un PPTX de demo.

### "Genere un deck a partir de ce CSV"
→ **Mode 3 (Donnees)** : lire le CSV, parser avec `parseCSV()`, transformer et generer le .pptx.

### "Voici un AST JSON, genere le PPTX"
→ **Mode 2 (AST)** : valider l'AST avec `validateAST()`, transformer et rendre en .pptx.

## Notes importantes

- Tous les chemins sont relatifs a la racine du skill (`pptx-generator/`)
- Le gabarit par defaut est Tier 2 avec 6 layouts natifs
- Les layouts non supportes sont automatiquement degrades via une cascade de fallback (ex: `architecture` → `bullets`)
- Le skill fonctionne en francais et en anglais
- Les tests se lancent avec `npx vitest run` depuis le repertoire `pptx-generator/`
- Le gabarit par defaut est genere par `scripts/buildDefaultTemplate.ts` — ne pas modifier le .pptx a la main
