import type { TemplateCapabilities } from '../schema/capabilities.js';
import { MAX_BULLETS, MAX_WORDS_PER_BULLET, MAX_TITLE_CHARS } from '../schema/constraints.js';

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

  const layoutDescriptions = [
    '- "title": Title slide with title + subtitle. Use for the opening slide.',
    '- "section": Section divider with title + subtitle. Use to separate major sections.',
    '- "bullets": Slide with title + bullet points. The workhorse layout. Supports optional icons per item.',
    '- "generic": Slide with title + free text body. Use for paragraphs or fallback.',
    layouts.includes('twoColumns') ? '- "twoColumns": Two-column slide. Use bullets elements with column: "left" or "right".' : '',
    layouts.includes('timeline') ? '- "timeline": Timeline with events. Use timeline element with date, label, status (done/in-progress/planned), optional icon per event.' : '',
    layouts.includes('architecture') ? '- "architecture": Architecture diagram. Use diagram element with nodes (id, label, layer, icon?) and edges (from, to).' : '',
    layouts.includes('kpi') ? '- "kpi": Key performance indicators. Use kpi element with indicators (label, value, unit?, trend?, icon?).' : '',
    layouts.includes('quote') ? '- "quote": Citation slide. Use quote element with text, author?, icon?.' : '',
    layouts.includes('chart') ? '- "chart": Chart slide. Use chart element with chartType (bar/line/pie/donut/stackedBar) and data series. Options: valueFormat, showDataLabels, legendPosition, colors, gridLines, axis labels/limits.' : '',
    layouts.includes('table') ? '- "table": Table slide. Use table element with headers and rows arrays.' : '',
    layouts.includes('imageText') ? '- "imageText": Image + text layout. Use with text and image elements side by side.' : '',
    layouts.includes('roadmap') ? '- "roadmap": Roadmap/milestones layout. Use timeline element with date, label, status.' : '',
    layouts.includes('process') ? '- "process": Process flow layout. Use timeline element with sequential steps.' : '',
    layouts.includes('comparison') ? '- "comparison": Side-by-side comparison. Use bullets elements with column: "left" or "right".' : '',
  ].filter(Boolean).join('\n');

  const elementTypes = [
    '- { type: "title", text: "..." } — Slide title (required on every slide)',
    '- { type: "subtitle", text: "..." } — Subtitle (for title/section layouts)',
    '- { type: "text", text: "..." } — Free text body (for generic layout)',
    '- { type: "bullets", items: [...], column?: "left"|"right", icons?: [...] } — Bullet list with optional Lucide icon names per item',
    '- { type: "timeline", events: [{ date, label, status?, icon? }] } — Timeline events with optional icons',
    '- { type: "diagram", nodes: [{ id, label, layer?, icon? }], edges: [{ from, to }] } — Architecture diagram',
    layouts.includes('kpi') ? '- { type: "kpi", indicators: [{ label, value, unit?, trend?, icon? }] } — Key metrics' : '',
    layouts.includes('quote') ? '- { type: "quote", text: "...", author?: "...", icon?: "..." } — Citation with optional decorative icon' : '',
    layouts.includes('chart') ? '- { type: "chart", chartType: "bar"|"line"|"pie"|"donut"|"stackedBar", data: { labels: [...], series: [{ name, values }] }, options?: { valueFormat?, showDataLabels?, legendPosition?, colors?, ... } } — Chart' : '',
    layouts.includes('table') ? '- { type: "table", headers: [...], rows: [[...], ...] } — Data table' : '',
  ].filter(Boolean).join('\n');

  return `You are a presentation content architect. Generate a JSON AST for a PowerPoint presentation.

## Output Format

Respond with ONLY a valid JSON object matching this schema:

\`\`\`json
${schemaExample}
\`\`\`

## Available Layouts

Use ONLY these layouts: ${layouts.map(l => `"${l}"`).join(', ')}

Layout descriptions:
${layoutDescriptions}

## Element Types

${elementTypes}

## Content Rules (STRICT)

- Maximum ${MAX_BULLETS} bullet points per slide. If you need more, create multiple slides.
- Maximum ${MAX_WORDS_PER_BULLET} words per bullet point. Be concise.
- Titles must be under ${MAX_TITLE_CHARS} characters.
- Every slide MUST have a title element.
- Start with a "title" layout slide and end with a closing slide.
- Aim for 5-12 slides depending on content depth.

## User Brief

${userBrief}

Generate the presentation AST now. Output ONLY the JSON, no explanations.`;
}

/**
 * Summarizes raw data for inclusion in an LLM prompt.
 * Extracts column names, row count, and sample values.
 */
function summarizeData(
  data: string | unknown,
  format: 'csv' | 'json',
): string {
  if (format === 'csv' && typeof data === 'string') {
    const lines = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter(Boolean);
    if (lines.length === 0) return 'Empty CSV.';
    const headers = lines[0];
    const rowCount = lines.length - 1;
    const sample = lines.slice(1, Math.min(4, lines.length)).join('\n');
    return `CSV with ${rowCount} rows.\nColumns: ${headers}\n\nSample rows:\n${sample}`;
  }

  if (format === 'json') {
    if (Array.isArray(data)) {
      const sample = data.slice(0, 3).map(item => JSON.stringify(item)).join('\n');
      return `JSON array with ${data.length} items.\n\nSample:\n${sample}`;
    }
    const preview = JSON.stringify(data, null, 2).slice(0, 500);
    return `JSON object:\n${preview}`;
  }

  return 'Unknown data format.';
}

/**
 * Builds a system prompt for Claude to generate a narrated presentation
 * from raw data (CSV or JSON). Unlike buildASTPrompt, this prompt
 * includes a data summary and asks for contextual narration.
 */
export function buildDataPrompt(
  capabilities: TemplateCapabilities,
  data: string | unknown,
  format: 'csv' | 'json',
  title: string,
): string {
  const basePrompt = buildASTPrompt(capabilities, `Create a presentation titled "${title}" based on the data below.`);
  const dataSummary = summarizeData(data, format);

  return `${basePrompt}

## Data to Present

${dataSummary}

## Additional Instructions for Data Presentations

- Add narrative context: don't just list data — explain what it means, highlight trends, call out outliers.
- Use a "title" slide as the opener with the presentation title.
- Use "kpi" slides for key metrics if numeric aggregates are available.
- Use "chart" slides (bar/line/pie) when data has clear numeric trends or comparisons.
- Use "table" slides to show detailed breakdowns.
- Use "bullets" slides for insights, analysis, and takeaways.
- End with a summary or recommendations slide.
- Keep the tone professional and data-driven.`;
}
