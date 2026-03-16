# pptx-generator

A Claude Code plugin for generating professional PowerPoint presentations from prompts, AST JSON, or data, with template validation.

## Installation

### As a Claude Code plugin (recommended)

Install the plugin using the Claude Code CLI or the in-app plugin manager.

**Local development / testing:**

```bash
claude --plugin-dir ./pptx-generator
```

This loads the plugin for the current session. Skills are available under the `pptx-generator:` namespace (e.g., `/pptx-generator:pptx-generator`).

**From a marketplace (once published):**

```bash
claude plugin install pptx-generator@<marketplace-name>
```

Or install interactively using `/plugin` inside Claude Code.

### Dependencies

Before using the plugin, install Node.js dependencies:

```bash
cd pptx-generator
npm install
```

## Plugin structure

```
pptx-generator/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest (metadata)
├── skills/
│   └── pptx-generator/
│       └── SKILL.md           # Main skill definition
├── CLAUDE.md                  # Project conventions for Claude
├── src/                       # Source code (TypeScript)
├── tests/                     # Test suite
├── assets/                    # Default template and capabilities
├── scripts/                   # Build scripts
├── references/                # Designer guide, AST schema, integration notes
└── package.json               # Node.js package metadata
```

## Usage

Once installed, the skill activates when you mention presentations, slides, PowerPoint, PPTX, or related terms. It supports four modes:

1. **Prompt mode** -- describe a presentation in natural language
2. **AST mode** -- provide a JSON AST conforming to the schema
3. **Data mode** -- provide a CSV or JSON data file
4. **Validation mode** -- validate a PowerPoint template

See the `SKILL.md` for detailed instructions on each mode.

## CLI

The plugin also provides a CLI for direct use:

```bash
# Validate a template
npx tsx src/cli.ts validate <template.pptx> [--json] [--demo] [--strict] [-o manifest.json]

# Generate from AST
npx tsx src/cli.ts generate --ast <ast.json> [--template template.pptx] [-o output.pptx]

# Generate from data
npx tsx src/cli.ts generate --data <data.csv> --title "Title" [--template template.pptx] [-o output.pptx]
```

## Development

```bash
# Run tests
npx vitest run

# Rebuild the default template
npx tsx scripts/buildDefaultTemplate.ts
```

## License

ISC
