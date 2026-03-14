#!/usr/bin/env node

/**
 * pptx-generator-orchestrator.mjs
 *
 * Pilote Claude Code via `claude -p` pour implémenter
 * le projet pptx-generator en phases séquentielles.
 *
 * Prérequis :
 *   - Claude Code installé (claude dans le PATH)
 *   - Abonnement Claude Pro/Team/Enterprise actif
 *   - spec-skill-pptx-generator.md à côté de ce fichier
 *
 * Usage :
 *   node pptx-generator-orchestrator.mjs [options]
 *
 * Options :
 *   --phase N          Reprendre à la phase N (1-5). Défaut: 1
 *   --project-dir DIR  Répertoire du projet. Défaut: ./pptx-generator
 *   --model MODEL      Modèle (sonnet, opus). Défaut: défaut Claude Code
 *   --dry-run          Affiche les prompts sans exécuter
 *   --verbose          Sortie complète de Claude Code
 *   --no-retry         Pas de retry automatique
 */

import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

// ─── CLI args ───────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultVal;
  if (idx + 1 >= args.length) return defaultVal;
  const val = args[idx + 1];
  if (val.startsWith("--")) return defaultVal;
  return val;
}
const hasFlag = (name) => args.includes(`--${name}`);

const startPhase = parseInt(getArg("phase", "1"), 10);
const projectDir = path.resolve(getArg("project-dir", "./pptx-generator"));
const modelFlag = getArg("model", "");
const dryRun = hasFlag("dry-run");
const verbose = hasFlag("verbose");
const noRetry = hasFlag("no-retry");

// ─── Couleurs terminal ──────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
};

function log(color, prefix, msg) {
  const ts = new Date().toLocaleTimeString("fr-CA", { hour12: false });
  console.log(
    `${C.dim}${ts}${C.reset} ${color}${C.bold}[${prefix}]${C.reset} ${msg}`
  );
}

function separator() {
  console.log(`${C.dim}${"─".repeat(70)}${C.reset}`);
}

// ─── Vérifier que claude est disponible ─────────────────────
function checkClaude() {
  try {
    const version = execSync("claude --version 2>&1", {
      stdio: "pipe",
    })
      .toString()
      .trim();
    log(C.green, "CHECK", `Claude Code: ${version}`);
    return true;
  } catch {
    log(
      C.red,
      "CHECK",
      "Claude Code n'est pas installé ou pas dans le PATH"
    );
    log(
      C.yellow,
      "HINT",
      "Installez: curl -fsSL https://claude.ai/install.sh | bash"
    );
    return false;
  }
}

// ─── Initialisation du projet ───────────────────────────────
function ensureProjectDir() {
  if (!fs.existsSync(projectDir)) {
    log(C.cyan, "INIT", `Création de ${projectDir}`);
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const pkgPath = path.join(projectDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    log(C.cyan, "INIT", "npm init + dépendances...");
    execSync("npm init -y", { cwd: projectDir, stdio: "pipe" });
    execSync(
      "npm install typescript pptxgenjs zod jszip xml2js commander",
      { cwd: projectDir, stdio: "inherit" }
    );
    execSync("npm install -D vitest @types/node @types/xml2js tsx", {
      cwd: projectDir,
      stdio: "inherit",
    });
    log(C.green, "INIT", "Dépendances installées");
  }

  // tsconfig.json
  const tsPath = path.join(projectDir, "tsconfig.json");
  if (!fs.existsSync(tsPath)) {
    fs.writeFileSync(
      tsPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "bundler",
            strict: true,
            esModuleInterop: true,
            outDir: "dist",
            rootDir: "src",
            declaration: true,
            resolveJsonModule: true,
            skipLibCheck: true,
          },
          include: ["src"],
        },
        null,
        2
      )
    );
  }

  // vitest.config.ts
  const vitestPath = path.join(projectDir, "vitest.config.ts");
  if (!fs.existsSync(vitestPath)) {
    fs.writeFileSync(
      vitestPath,
      `import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
  },
});
`
    );
  }

  // docs/spec.md
  const docsDir = path.join(projectDir, "docs");
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  const specSource = path.resolve("spec-skill-pptx-generator.md");
  const specDest = path.join(docsDir, "spec.md");
  if (fs.existsSync(specSource) && !fs.existsSync(specDest)) {
    fs.copyFileSync(specSource, specDest);
    log(C.cyan, "INIT", "Spec copiée dans docs/spec.md");
  } else if (!fs.existsSync(specDest)) {
    log(
      C.yellow,
      "WARN",
      "spec-skill-pptx-generator.md introuvable à côté de l'orchestrateur"
    );
  }

  // CLAUDE.md
  const claudeMd = path.join(projectDir, "CLAUDE.md");
  if (!fs.existsSync(claudeMd)) {
    fs.writeFileSync(
      claudeMd,
      `# PPTX Generator

## Contexte
Système de génération de présentations PowerPoint piloté par un AST,
avec validation de gabarits et dégradation gracieuse.
La spec complète est dans docs/spec.md. Lis-la au début de chaque phase.

## Stack
- TypeScript strict, Node.js, ESM
- Zod pour la validation de schémas
- PptxGenJS pour la génération PPTX
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
Si assets/default-template.pptx existe, c'est un gabarit Tier 1 valide
créé manuellement. Ne jamais le modifier programmatiquement.
Sinon, créer des fixtures de test programmatiques avec PptxGenJS.

## Règles
- Ne pas installer de dépendances sans raison
- Écrire les tests AVANT de déclarer terminé
- npx vitest run doit passer à 100%
- Pas de tests commentés ou skip
`
    );
    log(C.cyan, "INIT", "CLAUDE.md créé");
  }

  for (const d of ["src", "tests", "assets"]) {
    const p = path.join(projectDir, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }

  log(C.green, "INIT", "Projet prêt");
}

// ─── Exécuter claude -p avec stream-json ────────────────────
const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes par invocation

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const cmdArgs = [
      "-p",
      prompt,
      "--allowedTools",
      "Edit,Write,MultiEdit,Bash,Read,Glob,Grep",
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
    ];
    if (modelFlag) cmdArgs.push("--model", modelFlag);

    log(C.blue, "CLAUDE", `Lancement...`);

    const child = spawn("claude", cmdArgs, {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    let lineBuffer = "";

    // Statistiques de la session
    const stats = { toolCalls: 0, tools: {}, textChunks: 0 };
    let currentTool = null;
    let toolStartTime = null;
    let lastActivityTime = Date.now();

    // Timeout: tue le process s'il est inactif trop longtemps
    const timeoutTimer = setTimeout(() => {
      log(C.red, "TIMEOUT", `Claude inactif depuis ${CLAUDE_TIMEOUT_MS / 1000}s — abandon`);
      child.kill("SIGTERM");
    }, CLAUDE_TIMEOUT_MS);

    // Timer d'inactivité (2 min sans output = alerte)
    const inactivityInterval = setInterval(() => {
      const idleSec = Math.floor((Date.now() - lastActivityTime) / 1000);
      if (idleSec > 120 && idleSec % 30 === 0) {
        log(C.yellow, "IDLE", `Aucune activité depuis ${idleSec}s...`);
      }
    }, 10_000);

    /**
     * Traite une ligne NDJSON du stream-json de Claude Code.
     */
    function processStreamLine(line) {
      if (!line.trim()) return;
      lastActivityTime = Date.now();

      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        // Pas du JSON valide — afficher tel quel si verbose
        if (verbose) process.stdout.write(line + "\n");
        return;
      }

      const type = msg.type;

      // ── stream_event : événements temps réel de l'API Claude ──
      if (type === "stream_event") {
        const event = msg.event;
        if (!event) return;
        const eventType = event.type;

        if (eventType === "content_block_start") {
          const block = event.content_block;
          if (block?.type === "tool_use") {
            currentTool = block.name;
            toolStartTime = Date.now();
            stats.toolCalls++;
            stats.tools[currentTool] = (stats.tools[currentTool] || 0) + 1;
            log(C.cyan, "TOOL", `${currentTool} ...`);
          }
        } else if (eventType === "content_block_delta") {
          const delta = event.delta;
          if (delta?.type === "text_delta") {
            stats.textChunks++;
            if (verbose) {
              process.stdout.write(delta.text);
            }
          } else if (delta?.type === "input_json_delta" && verbose) {
            // Input JSON du tool call — afficher seulement en verbose
            process.stdout.write(`${C.dim}${delta.partial_json}${C.reset}`);
          }
        } else if (eventType === "content_block_stop") {
          if (currentTool) {
            const elapsed = ((Date.now() - toolStartTime) / 1000).toFixed(1);
            log(C.cyan, "TOOL", `${currentTool} terminé (${elapsed}s)`);
            currentTool = null;
            toolStartTime = null;
          }
        }
        return;
      }

      // ── assistant : message complet de l'assistant ──
      if (type === "assistant") {
        const message = msg.message;
        if (!message?.content) return;
        for (const block of message.content) {
          if (block.type === "text" && block.text) {
            // Afficher un résumé du texte de l'assistant
            const preview = block.text.substring(0, 200).replace(/\n/g, " ");
            log(C.white, "AGENT", preview + (block.text.length > 200 ? "..." : ""));
          } else if (block.type === "tool_use") {
            // En mode non-verbose, afficher les détails du tool call
            if (!verbose) {
              const input = JSON.stringify(block.input || {});
              const preview = input.substring(0, 120);
              log(C.dim, "CALL", `${block.name}(${preview}${input.length > 120 ? "..." : ""})`);
            }
          }
        }
        return;
      }

      // ── result : résultat final ──
      if (type === "result") {
        const cost = msg.cost_usd;
        const duration = msg.duration_ms;
        const turns = msg.num_turns;
        const parts = [];
        if (turns) parts.push(`${turns} tours`);
        if (duration) parts.push(`${(duration / 1000).toFixed(0)}s`);
        if (cost) parts.push(`$${cost.toFixed(4)}`);
        if (parts.length > 0) {
          log(C.green, "RESULT", parts.join(" · "));
        }
        if (msg.subagent_error) {
          log(C.red, "ERROR", `Erreur agent: ${msg.subagent_error}`);
        }
        return;
      }

      // ── system : messages système (init, permissions, etc.) ──
      if (type === "system") {
        const text = msg.message || msg.subtype || JSON.stringify(msg);
        log(C.yellow, "SYSTEM", text.substring(0, 200));
        return;
      }
    }

    child.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;

      // NDJSON : chaque ligne = un objet JSON
      lineBuffer += text;
      const lines = lineBuffer.split("\n");
      // Garder la dernière ligne incomplète dans le buffer
      lineBuffer = lines.pop() || "";
      for (const line of lines) {
        processStreamLine(line);
      }
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      // Afficher stderr en temps réel (souvent des infos utiles)
      if (text.trim()) {
        log(C.yellow, "STDERR", text.trim().substring(0, 200));
      }
    });

    child.on("close", (code) => {
      clearTimeout(timeoutTimer);
      clearInterval(inactivityInterval);

      // Traiter la dernière ligne du buffer
      if (lineBuffer.trim()) {
        processStreamLine(lineBuffer);
      }

      // Résumé des stats
      if (stats.toolCalls > 0) {
        const toolSummary = Object.entries(stats.tools)
          .map(([name, count]) => `${name}×${count}`)
          .join(", ");
        log(C.blue, "STATS", `${stats.toolCalls} appels d'outils : ${toolSummary}`);
      }

      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutTimer);
      clearInterval(inactivityInterval);
      reject(err);
    });
  });
}

// ─── Exécuter les tests ─────────────────────────────────────
function runTests() {
  log(C.yellow, "VERIFY", "npx vitest run ...");
  try {
    const output = execSync("npx vitest run 2>&1", {
      cwd: projectDir,
      stdio: "pipe",
      timeout: 120_000,
    }).toString();

    const failMatch = output.match(/(\d+)\s+failed/);
    const passMatch = output.match(/(\d+)\s+passed/);

    if (failMatch && parseInt(failMatch[1]) > 0) {
      log(C.red, "VERIFY", `${failMatch[1]} tests échouent`);
      return { passed: false, output };
    }

    const count = passMatch ? passMatch[1] : "?";
    log(C.green, "VERIFY", `${count} tests passent ✔`);
    return { passed: true, output };
  } catch (err) {
    const output =
      (err.stdout || "").toString() + (err.stderr || "").toString();
    log(C.red, "VERIFY", "Tests échouent");
    return { passed: false, output };
  }
}

// ─── Phases ─────────────────────────────────────────────────
const phases = [
  {
    id: 1,
    name: "Fondations — Schémas Zod + Template Reader",
    prompt: `Lis docs/spec.md en entier avant de commencer.

Implémente la phase 1 — Fondations :

1. src/schema/presentation.ts
   - Schémas Zod pour l'AST : Presentation, Slide, LayoutType (enum),
     et tous les types Element V1 (title, subtitle, text, bullets, diagram, timeline).
   - Exporter les types TypeScript inférés.

2. src/schema/capabilities.ts
   - Schéma Zod pour template-capabilities.json
   - Inclure : tier, supported_layouts, unsupported_layouts, fallback_map,
     placeholders, theme, slide_dimensions.

3. src/validator/types.ts
   - Interfaces PlaceholderInfo, LayoutInfo, ThemeInfo, TemplateInfo

4. src/validator/templateReader.ts
   - Fonction readTemplate(pptxPath: string): Promise<TemplateInfo>
   - Utilise JSZip pour ouvrir le .pptx, parse les slideLayouts XML
   - Extraire : noms des layouts, placeholders (index, type, position EMU), thème

5. Tests :
   - tests/schema/presentation.test.ts — AST valide accepté, invalide rejeté
   - tests/schema/capabilities.test.ts — manifeste valide
   - tests/validator/templateReader.test.ts — créer un .pptx minimal avec PptxGenJS comme fixture

Exécute npx vitest run. Corrige jusqu'à ce que TOUT passe.`,
  },

  {
    id: 2,
    name: "Validateur — Règles + Manifeste + CLI",
    prompt: `Lis docs/spec.md sections 3.4 et 4 (validateur, capacités, règles).

Implémente la phase 2 — Validateur :

1. src/validator/rules/ — Un fichier par catégorie :
   - layoutRules.ts (LAY-001 à LAY-010)
   - placeholderRules.ts (PH-001 à PH-015)
   - dimensionRules.ts (DIM-001 à DIM-005)
   - themeRules.ts (THM-001 à THM-004)
   - tierRules.ts (TIER-001 à TIER-003)
   - manifestRules.ts (MAN-001 à MAN-002)
   - index.ts — exporte tout dans un seul tableau

   Chaque règle : { id, severity, description, validate(template) → { id, status, message, context? } }

2. src/validator/engine.ts — runValidation(template): ValidationResult[]
3. src/validator/manifestGenerator.ts — calcule tier + fallback_map
4. src/validator/formatter.ts — formatText() et formatJson()
5. src/cli.ts — CLI Commander.js (--demo = "not yet" pour l'instant)

6. Tests :
   - tests/validator/rules/ — un test par catégorie minimum
   - tests/validator/engine.test.ts
   - tests/validator/manifestGenerator.test.ts — tier + fallback

Exécute npx vitest run. Corrige jusqu'à ce que TOUT passe.`,
  },

  {
    id: 3,
    name: "Transform — Dégradation + Règles + Overflow",
    prompt: `Lis docs/spec.md sections 3.2 et 4.4 (Transform, dégradation).

Implémente la phase 3 — Transform :

1. src/transform/layoutResolver.ts — layout absent → cascade fallback_map → _resolvedLayout + _warnings
2. src/transform/contentValidator.ts — bullets>5 → split, bullet>12 mots → tronquer, titre>60 chars → tronquer
3. src/transform/overflowHandler.ts — auto-split, font sizing adaptatif (4-5 bullets → -2pt, min 12)
4. src/transform/index.ts — pipeline : resolveLayouts → contentValidator → overflowHandler

5. Tests :
   - "kpi" sur Tier 1 → "bullets"
   - "roadmap" sans timeline → cascade → "bullets"
   - bullet 20 mots → tronqué
   - 8 bullets → 2 slides
   - test intégré pipeline complet

Exécute npx vitest run. Corrige jusqu'à ce que TOUT passe.`,
  },

  {
    id: 4,
    name: "Renderer — Layouts texte + E2E",
    prompt: `Lis docs/spec.md section 3.3 (Renderer).

Implémente la phase 4 — Renderer (layouts texte, PAS de shapes) :

1. src/renderer/pptxRenderer.ts — PptxGenJS, addSlide + addText par layout résolu
2. src/renderer/placeholderFiller.ts — logique par type de layout
   (title→centré, bullets→liste, twoColumns→2 colonnes, canvas→placeholder texte)
3. Respecter _fontSizeOverride et _splitIndex

4. Tests :
   - Générer un PPTX, vérifier ouverture JSZip + nombre de slides
   - E2E : AST → Transform(Tier 1) → Render → fichier valide

Exécute npx vitest run. Corrige jusqu'à ce que TOUT passe.`,
  },

  {
    id: 5,
    name: "Shapes + Démo generator",
    prompt: `Lis docs/spec.md sections 3.3 (shapes) et 6 (PPTX démo).

Implémente la phase 5 :

1. src/renderer/timelineDrawer.ts — ligne, cercles colorés (done/progress/planned), labels alternés
2. src/renderer/architectureDrawer.ts — nœuds par layer, rectangles arrondis, connecteurs fléchés
3. Brancher dans pptxRenderer.ts
4. src/validator/demoGenerator.ts — 14-16 slides (voir spec section 6), pipeline complet
5. Brancher --demo dans cli.ts

6. Tests :
   - timeline + architecture : shapes dans le XML
   - demoGenerator : 14+ slides, fichier valide

Exécute npx vitest run. Corrige jusqu'à ce que TOUT passe.`,
  },
];

// ─── Exécuter une phase ─────────────────────────────────────
async function runPhase(phase, promptOverride) {
  separator();
  log(
    C.magenta,
    `PHASE ${phase.id}`,
    `${C.bold}${phase.name}${C.reset}`
  );
  separator();

  const prompt = promptOverride || phase.prompt;

  if (dryRun) {
    console.log(`\n${C.dim}${prompt}${C.reset}\n`);
    log(C.yellow, "DRY-RUN", "Prompt affiché, pas d'exécution");
    return { success: true, skipped: true };
  }

  const startTime = Date.now();
  const result = await runClaude(prompt);
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  if (result.code !== 0) {
    log(
      C.red,
      `PHASE ${phase.id}`,
      `Code ${result.code} (${elapsed} min)`
    );
  } else {
    log(C.green, `PHASE ${phase.id}`, `Terminé en ${elapsed} min`);
  }

  const testResult = runTests();
  return testResult.passed
    ? { success: true }
    : { success: false, testOutput: testResult.output };
}

// ─── Retry ──────────────────────────────────────────────────
async function runPhaseWithRetry(phase, maxRetries = 2) {
  let result = await runPhase(phase);
  if (result.success || result.skipped || noRetry) return result;

  for (let retry = 1; retry <= maxRetries; retry++) {
    log(
      C.yellow,
      "RETRY",
      `Phase ${phase.id} — tentative ${retry}/${maxRetries}`
    );

    const errors = (result.testOutput || "")
      .split("\n")
      .filter(
        (l) =>
          l.includes("FAIL") ||
          l.includes("Error") ||
          l.includes("expected") ||
          l.includes("received") ||
          l.includes("×")
      )
      .slice(0, 30)
      .join("\n");

    const retryPrompt = `Des tests échouent encore. Erreurs :
\`\`\`
${errors || "Exécute npx vitest run pour voir les détails"}
\`\`\`

Lis les fichiers dans src/ et tests/. Corrige uniquement ce qui échoue.
Exécute npx vitest run et assure-toi que TOUT passe.`;

    result = await runPhase(phase, retryPrompt);
    if (result.success) break;
  }
  return result;
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  console.log(`
${C.cyan}${C.bold}╔════════════════════════════════════════════════════════════════╗
║          PPTX Generator — Orchestrateur de build              ║
║          Pilote Claude Code via claude -p (abonnement)        ║
╚════════════════════════════════════════════════════════════════╝${C.reset}

  ${C.bold}Projet${C.reset}    : ${projectDir}
  ${C.bold}Modèle${C.reset}    : ${modelFlag || "(défaut Claude Code)"}
  ${C.bold}Phases${C.reset}    : ${startPhase} → ${phases.length}
  ${C.bold}Dry-run${C.reset}   : ${dryRun}
  ${C.bold}Verbose${C.reset}   : ${verbose}
`);

  if (!checkClaude()) process.exit(1);
  ensureProjectDir();
  console.log();

  const results = {};

  for (const phase of phases) {
    if (phase.id < startPhase) {
      log(C.dim, `PHASE ${phase.id}`, "Sautée");
      results[phase.id] = { skipped: true };
      continue;
    }

    const result = await runPhaseWithRetry(phase);
    results[phase.id] = result;

    if (!result.success && !result.skipped) {
      console.log();
      log(C.red, "STOP", `Phase ${phase.id} échouée.`);
      log(C.yellow, "HINT", `cd ${projectDir} && claude`);
      log(
        C.yellow,
        "HINT",
        `Puis relancez: node pptx-generator-orchestrator.mjs --phase ${phase.id}`
      );
      break;
    }
    console.log();
  }

  // Rapport final
  console.log();
  separator();
  log(C.cyan, "RAPPORT", `${C.bold}Résultat${C.reset}`);
  separator();

  let allPassed = true;
  for (const phase of phases) {
    const r = results[phase.id];
    const icon = !r
      ? `${C.dim}○`
      : r.skipped
        ? `${C.dim}◌`
        : r.success
          ? `${C.green}●`
          : `${C.red}✘`;
    const status = !r
      ? "—"
      : r.skipped
        ? "sautée"
        : r.success
          ? "succès"
          : "ÉCHEC";
    console.log(
      `  ${icon}${C.reset}  Phase ${phase.id} — ${phase.name} : ${status}`
    );
    if (r && !r.success && !r.skipped) allPassed = false;
  }

  console.log();
  if (allPassed) {
    log(
      C.green,
      "DONE",
      "Toutes les phases terminées ! Créez un gabarit .pptx et testez."
    );
  }
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  log(C.red, "FATAL", err.message);
  process.exit(1);
});
