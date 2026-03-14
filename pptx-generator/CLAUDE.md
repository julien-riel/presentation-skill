# PPTX Generator

## Contexte
Système de génération de présentations PowerPoint piloté par un AST,
avec validation de gabarits et dégradation gracieuse.
La spec complète est dans docs/spec.md. Lis-la au début de chaque phase.

## Stack
- TypeScript strict, Node.js, ESM
- Zod pour la validation de schémas
- JSZip + OOXML brut pour la génération PPTX
- JSZip + xml2js pour la lecture/validation de gabarits
- Vitest pour les tests
- Commander.js pour le CLI

## Conventions
- Code source dans src/, tests dans tests/
- Un fichier = une responsabilité
- Exporter des types + fonctions pures
- Tests par module (tests/validator/, tests/transform/, etc.)
- Fichiers en camelCase.ts
- Lancer les tests: npx vitest run

## Gabarit de test
assets/default-template.pptx est généré par scripts/buildDefaultTemplate.ts.
Pour le reconstruire: npx tsx scripts/buildDefaultTemplate.ts
Ne pas modifier le .pptx à la main — toujours passer par le script.

## Règles
- Ne pas installer de dépendances sans raison
- Écrire les tests AVANT de déclarer terminé
- npx vitest run doit passer à 100%
- Pas de tests commentés ou skip
