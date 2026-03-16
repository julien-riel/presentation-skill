# Changelog

## 1.0.0 — 2026-03-16

### Ajouts

- Generation PPTX complete a partir d'un AST, de donnees CSV/JSON ou de prompts LLM
- Rendu natif de graphiques OOXML (bar, line, pie, donut, stackedBar)
- Support des icones SVG (Lucide) dans les puces, citations, timelines et diagrammes
- Layouts avances : KPI, table, timeline, architecture, roadmap, process, comparison, quote, imageText
- Narration LLM pour les presentations basees sur des donnees
- Validation de gabarits PPTX avec generation de manifeste de capacites
- CLI avec commandes validate et generate
- Gabarit par defaut avec parties auxiliaires pour compatibilite PowerPoint

### Corrections

- Icone de citation affichee uniquement lorsque le texte est present
- Retours chariot `\r\n` normalises dans le parseur CSV
- `computeTier` retourne 0 lorsque le Tier 1 n'est pas satisfait
- Switch exhaustif, garde NaN et tests supplementaires suite a la revue

### Ameliorations

- Lecture du fichier gabarit en une seule passe au lieu de deux (`renderToBuffer`)
- Regles de validation et descriptions traduites en anglais
- Qualite des tests : gardes de type, chemins uniques, helpers partages
- 10 recommandations qualite appliquees (refactoring global)
- Documentation alignee avec le code (imports, placeholders, severite, structure)
