# pptx-generator — Reste à faire

Ce document liste ce qui manque pour transformer le projet en un **plugin Claude Code** prêt à distribuer.

---

## ~~1. SKILL.md — Point d'entrée du skill~~ FAIT

SKILL.md existe (184 lignes) avec description, déclencheurs, modes d'opération, exemples et référence au gabarit par défaut.

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
| Gabarit par défaut professionnel | Haute | Le template actuel est fonctionnel mais visuellement vide |
| Renderers KPI/Chart/Table natifs | Moyenne | Actuellement dégradés en bullets — acceptable pour v1 |
| Cache du manifeste (comparaison dates) | Basse | Spec section 8.3 — re-générer si .pptx plus récent |
| Mode génération depuis données avec LLM | Moyenne | `dataParser.ts` fait l'analyse, mais la narration LLM manque |
| Support Tier 3 layouts (roadmap, process, comparison, etc.) | Basse | La dégradation fonctionne, les renderers spécialisés sont du bonus |

---

## Ordre de priorité suggéré

1. **Gabarit professionnel** — créer dans PowerPoint, valider avec le CLI
2. **Renderers KPI/Chart/Table** — pour une couverture complète des types de slides
3. **Cache manifeste** — re-générer si .pptx plus récent
