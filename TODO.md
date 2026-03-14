# pptx-generator — Reste à faire

Ce document liste ce qui manque pour transformer le projet en un **skill Claude Code** prêt à distribuer dans l'entreprise.

---

## 1. SKILL.md — Point d'entrée du skill

Le fichier le plus important. C'est lui que Claude Code charge quand le skill est invoqué. Il n'existe pas encore.

**Contenu attendu :**
- Description du skill (une phrase)
- Déclencheurs : quand Claude doit activer ce skill (mots-clés : « présentation », « deck », « slides », « PowerPoint », « valider un gabarit »)
- Instructions pour le mode prompt libre : utiliser `buildASTPrompt()` pour construire le system prompt, générer le JSON AST, puis passer par le pipeline transform → render
- Instructions pour le mode validation : appeler le CLI `validate`
- Référence au gabarit par défaut et comment l'utilisateur peut fournir le sien
- Exemples d'invocations

**Pourquoi c'est critique :** Sans SKILL.md, le skill ne peut pas être chargé par Claude Code, VS Code (via Claude extension), ni Cowork.

---

## 2. Gabarit par défaut professionnel

Le template actuel (`assets/default-template.pptx`) est fonctionnellement correct (Tier 2, passe la validation) mais visuellement vide — les slideLayouts n'ont aucun style visuel (pas de fond, pas de couleurs de texte, pas de mise en forme).

**À faire :**
- Enrichir `scripts/buildDefaultTemplate.ts` pour ajouter du style dans les layouts XML :
  - Fond coloré pour LAYOUT_TITLE (ex: navy) et LAYOUT_SECTION (ex: accent)
  - Styles de texte par défaut dans les placeholders (taille, couleur, gras, alignement)
  - Fond légèrement teinté pour les layouts de contenu
  - Styles de puces dans le body placeholder de LAYOUT_BULLETS
- **Alternative :** Créer le template dans PowerPoint/Google Slides à la main, l'exporter en .pptx, et le valider avec le CLI. C'est plus rapide et le résultat sera meilleur qu'en XML brut.

---

## 3. Manifeste pré-généré

La spec demande `assets/default-capabilities.json` — le manifeste du template par défaut, pré-calculé pour éviter de relire le .pptx à chaque génération.

**À faire :**
- Ajouter une étape dans `buildDefaultTemplate.ts` qui génère aussi le manifeste JSON
- Modifier le renderer pour charger le manifeste depuis un fichier si disponible (au lieu de re-parser le .pptx)

---

## 4. Guide designer de gabarit

Fichier `references/guide-designer.md` — documentation pour les designers de l'entreprise qui veulent créer leur propre gabarit.

**Contenu attendu :**
- Noms de layouts à respecter (`LAYOUT_TITLE`, `LAYOUT_BULLETS`, etc.)
- Placeholders requis par layout (type + index)
- Tiers expliqués (Tier 1 minimum, Tier 2 recommandé)
- Comment valider leur gabarit (`npx tsx src/cli.ts validate mon-gabarit.pptx --demo`)
- Contraintes de dimensions (16:9, marges 0.5", etc.)
- Bonnes pratiques thème (contraste WCAG, polices lisibles)

---

## 5. Documentation du schéma AST

Fichier `references/ast-schema.md` — pour les développeurs qui veulent générer des AST programmatiquement.

**Contenu attendu :**
- Schéma complet avec exemples par type de layout
- Types d'éléments disponibles (title, subtitle, text, bullets, timeline, diagram, kpi, chart, table, quote)
- Champs ajoutés par le transform (`_resolvedLayout`, `_warnings`, etc.)
- Exemple JSON complet d'une présentation multi-slides

---

## 6. Orchestrateur principal (`src/index.ts`)

La spec prévoit un fichier `src/index.ts` qui orchestre les trois modes (validation, génération prompt, génération AST/data). Il n'existe pas.

**À faire :**
- Exporter une API programmatique propre :
  ```typescript
  export async function generateFromAST(ast, templatePath?): Promise<Buffer>
  export async function generateFromData(data, title, templatePath?): Promise<Buffer>
  export async function validateTemplate(templatePath): Promise<ValidationReport>
  export function buildPrompt(capabilities, brief): string
  ```
- C'est cette API que le SKILL.md référencera pour les appels internes

---

## 7. Packaging et distribution

Pour que le skill soit installable facilement.

**À faire :**
- Ajouter `"type": "module"` dans package.json (le code utilise déjà des imports ESM avec `.js` extensions)
- Nettoyer les dépendances : `pptxgenjs` n'est plus utilisé par le renderer — le retirer ou le garder si d'autres modules l'utilisent encore
- Ajouter un script `"build"` dans package.json pour compiler le TypeScript
- Ajouter un script `"validate"` et `"generate"` comme raccourcis CLI
- Créer un `.npmignore` ou configurer `"files"` dans package.json pour exclure tests/ et scripts/ de la distribution
- Vérifier que `npx tsx src/cli.ts` fonctionne sans installation globale

---

## 8. Intégration VS Code / Cowork

Pour que le skill fonctionne dans les différents environnements Claude.

**À faire :**
- Tester le chargement du SKILL.md dans Claude Code (`claude` CLI)
- Tester dans l'extension VS Code Claude
- Tester dans Claude Cowork
- S'assurer que les chemins relatifs fonctionnent (le skill doit pouvoir trouver `assets/default-template.pptx` relativement à son propre répertoire)
- Documenter l'installation : `git clone` + `npm install` + prêt

---

## 9. Améliorations futures (nice-to-have)

Ces éléments ne sont pas bloquants pour une v1 mais sont dans la spec :

| Fonctionnalité | Priorité | Notes |
|---|---|---|
| Renderers KPI/Chart/Table natifs | Moyenne | Actuellement dégradés en bullets — acceptable pour v1 |
| Cache du manifeste (comparaison dates) | Basse | Spec section 8.3 — re-générer si .pptx plus récent |
| Mode génération depuis données avec LLM | Moyenne | `dataParser.ts` fait l'analyse, mais la narration LLM manque |
| Support Tier 3 layouts (roadmap, process, comparison, etc.) | Basse | La dégradation fonctionne, les renderers spécialisés sont du bonus |
| Gabarit par défaut créé dans PowerPoint | Haute | Un vrai .pptx designé sera bien plus beau que du XML généré |

---

## Ordre de priorité suggéré

1. **SKILL.md** — sans ça, pas de skill
2. **Gabarit professionnel** — créer dans PowerPoint, valider avec le CLI
3. **Guide designer** — pour que les équipes fassent leurs propres gabarits
4. **src/index.ts** — API propre
5. **Packaging** — scripts npm, nettoyage dépendances
6. **Documentation AST** — pour les usages avancés
7. **Tests d'intégration** — VS Code, Cowork
