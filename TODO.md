# pptx-generator — Reste à faire

Ce document liste ce qui manque pour transformer le projet en un **plugin Claude Code** prêt à distribuer.

---

## ~~1. SKILL.md — Point d'entrée du skill~~ FAIT

SKILL.md existe (184 lignes) avec description, déclencheurs, modes d'opération, exemples et référence au gabarit par défaut.

---

## ~~2. Gabarit par défaut professionnel~~ FAIT

Le gabarit (`assets/default-template.pptx`) est Tier 2 avec style visuel professionnel :
- Fond navy pour LAYOUT_TITLE, fond bleu accent pour LAYOUT_SECTION
- Fond gris clair (F7F9FC) pour les layouts de contenu
- Styles de texte dans tous les placeholders (taille, couleur, gras, alignement, ancrage)
- Puces stylées avec couleur d'accent dans LAYOUT_BULLETS et LAYOUT_TWO_COLUMNS
- Ligne d'accent décorative sous le titre pour les layouts de contenu
- Police Calibri Light (titres) / Calibri (corps) via le thème

---

## ~~3. Manifeste pré-généré~~ FAIT

`assets/default-capabilities.json` existe et est généré par le script de build.

---

## ~~4. Guide designer de gabarit~~ FAIT

`references/guide-designer.md` existe avec noms de layouts, placeholders, tiers, cascade de fallback, contraintes de dimensions et bonnes pratiques thème.

---

## ~~5. Documentation du schéma AST~~ FAIT

`references/ast-schema.md` existe avec schéma complet, exemples par type, champs du transform et exemple JSON multi-slides.

---

## ~~6. Orchestrateur principal (`src/index.ts`)~~ FAIT

`src/index.ts` existe avec l'API programmatique complète (`generateFromAST`, `generateFromData`, `validateTemplate`, `buildPrompt`).

---

## ~~7. Packaging et distribution~~ FAIT

- `"type": "module"` dans package.json
- Scripts npm `validate` et `generate`
- `.npmignore`
- `.claude-plugin/plugin.json` pour la distribution via marketplace
- `xmlbuilder` et `pptxgenjs` ont été retirés des dépendances

---

## ~~8. Intégration VS Code / Cowork~~ FAIT

`references/integration-notes.md` existe avec les notes d'intégration.

---

## 9. Améliorations futures (nice-to-have)

Ces éléments ne sont pas bloquants pour une v1 mais sont dans la spec :

| Fonctionnalité | Priorité | Notes |
|---|---|---|
| ~~Support des icônes Lucide~~ | ~~Haute~~ | ~~FAIT — icônes sur bullets, timeline, KPI, quote, diagram~~ |
| ~~Gabarit par défaut professionnel~~ | ~~Haute~~ | ~~FAIT — fond coloré, styles de texte, puces, ligne d'accent~~ |
| ~~Renderers KPI/Table/Quote natifs~~ | ~~Moyenne~~ | ~~FAIT — KPI (cards colorées + trend icons), Table (header accent + alternating rows), Quote (centré + attribution)~~ |
| ~~Cache du manifeste (comparaison dates)~~ | ~~Basse~~ | ~~FAIT — sidecar `.capabilities.json` avec invalidation mtime~~ |
| ~~Support Tier 3 layouts (roadmap, process, comparison)~~ | ~~Basse~~ | ~~FAIT — roadmap (barres de phase), process (boîtes numérotées + flèches), comparison (colonnes avec headers)~~ |
| ~~Validation contenu KPI/Table~~ | ~~Moyenne~~ | ~~FAIT — max 6 indicateurs KPI, max 8 lignes / 6 colonnes table~~ |
| Renderer Chart natif | Basse | La dégradation en bullets est appropriée — les charts OOXML sont très complexes |
| Mode génération depuis données avec LLM | Moyenne | `dataParser.ts` fait l'analyse, mais la narration LLM manque |

---

## Ordre de priorité suggéré

1. **Mode données avec narration LLM** — enrichir les slides générées depuis CSV/JSON
2. **Renderer Chart natif** — complexité élevée, la dégradation fonctionne bien
