import type { TemplateCapabilities } from '../schema/capabilities.js';

/**
 * Builds a system prompt for Claude to generate a Presentation AST
 * from a user's free-text brief.
 *
 * This is used in skill mode (Claude-in-conversation), not via API.
 */
export function buildASTPrompt(
  capabilities: TemplateCapabilities,
  userBrief: string,
): string {
  const layouts = capabilities.supported_layouts;

  const schemaExample = JSON.stringify({
    title: "Presentation Title",
    metadata: { author: "Author", date: "2026-03-14" },
    slides: [
      {
        layout: "title",
        elements: [
          { type: "title", text: "Main Title" },
          { type: "subtitle", text: "Subtitle here" }
        ],
        notes: "Speaker notes for this slide"
      },
      {
        layout: "bullets",
        elements: [
          { type: "title", text: "Slide Title" },
          { type: "bullets", items: ["Point 1", "Point 2", "Point 3"] }
        ]
      }
    ]
  }, null, 2);

  return `You are a presentation content architect. Generate a JSON AST for a PowerPoint presentation.

## Output Format

Respond with ONLY a valid JSON object matching this schema:

\`\`\`json
${schemaExample}
\`\`\`

## Available Layouts

Use ONLY these layouts: ${layouts.map(l => `"${l}"`).join(', ')}

Layout descriptions:
- "title": Title slide with title + subtitle. Use for the opening slide.
- "section": Section divider with title + subtitle. Use to separate major sections.
- "bullets": Slide with title + bullet points. The workhorse layout.
- "generic": Slide with title + free text body. Use for paragraphs or fallback.
${layouts.includes('twoColumns') ? '- "twoColumns": Two-column slide. Use bullets elements with column: "left" or "right".' : ''}
${layouts.includes('timeline') ? '- "timeline": Timeline with events. Use timeline element with date, label, status (done/in-progress/planned).' : ''}
${layouts.includes('architecture') ? '- "architecture": Architecture diagram. Use diagram element with nodes (id, label, layer) and edges (from, to).' : ''}

## Element Types

- { type: "title", text: "..." } — Slide title (required on every slide)
- { type: "subtitle", text: "..." } — Subtitle (for title/section layouts)
- { type: "text", text: "..." } — Free text body (for generic layout)
- { type: "bullets", items: [...], column?: "left"|"right" } — Bullet list
- { type: "timeline", events: [{ date, label, status? }] } — Timeline events
- { type: "diagram", nodes: [{ id, label, layer? }], edges: [{ from, to }] } — Architecture diagram

## Content Rules (STRICT)

- Maximum 5 bullet points per slide. If you need more, create multiple slides.
- Maximum 12 words per bullet point. Be concise.
- Titles must be under 60 characters.
- Every slide MUST have a title element.
- Start with a "title" layout slide and end with a closing slide.
- Aim for 5-12 slides depending on content depth.

## User Brief

${userBrief}

Generate the presentation AST now. Output ONLY the JSON, no explanations.`;
}
