import type { Presentation, Slide } from '../schema/presentation.js';

const DATE_PATTERN = /^\d{4}[-/]?(Q[1-4]|[01]?\d|[A-Za-z]{3})$/;

/**
 * Detects the dominant data type from CSV headers and rows.
 */
export function detectDataType(
  headers: string[],
  rows: string[][],
): 'kpi' | 'timeline' | 'table' {
  if (rows.length === 0) return 'table';

  const hasDateColumn = headers.some((_, colIdx) => {
    const values = rows.map(r => r[colIdx] ?? '');
    return values.filter(v => DATE_PATTERN.test(v.trim())).length > values.length * 0.5;
  });
  if (hasDateColumn) return 'timeline';

  if (headers.length === 2) {
    const secondColNumeric = rows.every(r => {
      const val = (r[1] ?? '').replace(/[,$%]/g, '');
      return !isNaN(parseFloat(val));
    });
    if (secondColNumeric) return 'kpi';
  }

  return 'table';
}

function splitCSV(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));
  return { headers, rows };
}

export function parseCSV(csv: string, title: string): Presentation {
  const { headers, rows } = splitCSV(csv);
  const dataType = detectDataType(headers, rows);
  const slides: Slide[] = [];

  slides.push({
    layout: 'title',
    elements: [
      { type: 'title', text: title },
      { type: 'subtitle', text: `Generated from ${rows.length} data rows` },
    ],
  });

  if (dataType === 'kpi') {
    slides.push({
      layout: 'kpi',
      elements: [
        { type: 'title', text: 'Key Metrics' },
        {
          type: 'kpi',
          indicators: rows.map(row => ({
            label: row[0] ?? '',
            value: row[1] ?? '',
            unit: headers[1] ?? undefined,
          })),
        },
      ],
    });
  } else if (dataType === 'timeline') {
    const dateColIdx = headers.findIndex((_, idx) =>
      rows.filter(r => DATE_PATTERN.test((r[idx] ?? '').trim())).length > rows.length * 0.5
    );
    const labelColIdx = headers.findIndex((_, idx) => idx !== dateColIdx);
    const statusColIdx = headers.findIndex(h => h.toLowerCase() === 'status');

    slides.push({
      layout: 'timeline',
      elements: [
        { type: 'title', text: title },
        {
          type: 'timeline',
          events: rows.map(row => ({
            date: row[dateColIdx] ?? '',
            label: row[labelColIdx] ?? '',
            ...(statusColIdx >= 0 && row[statusColIdx]
              ? { status: row[statusColIdx] as 'done' | 'in-progress' | 'planned' }
              : {}),
          })),
        },
      ],
    });
  } else {
    slides.push({
      layout: 'table',
      elements: [
        { type: 'title', text: title },
        { type: 'table', headers, rows },
      ],
    });
  }

  return { title, slides };
}

function isArchitectureData(data: unknown): data is { nodes: unknown[]; edges: unknown[] } {
  return (
    typeof data === 'object' && data !== null &&
    'nodes' in data && 'edges' in data &&
    Array.isArray((data as Record<string, unknown>).nodes)
  );
}

function isKPIArray(data: unknown[]): boolean {
  return data.length > 0 && data.every(
    item => typeof item === 'object' && item !== null && 'label' in item && 'value' in item
  );
}

function isTimelineArray(data: unknown[]): boolean {
  return data.length > 0 && data.every(
    item => typeof item === 'object' && item !== null && 'date' in item && 'label' in item
  );
}

export function parseJSONData(data: unknown, title: string): Presentation {
  const slides: Slide[] = [
    {
      layout: 'title',
      elements: [
        { type: 'title', text: title },
        { type: 'subtitle', text: 'Generated from structured data' },
      ],
    },
  ];

  if (isArchitectureData(data)) {
    slides.push({
      layout: 'architecture',
      elements: [
        { type: 'title', text: title },
        {
          type: 'diagram',
          nodes: (data.nodes as Array<Record<string, string>>).map(n => ({
            id: n.id ?? '', label: n.label ?? '',
            ...(n.layer ? { layer: n.layer } : {}),
          })),
          edges: (data.edges as Array<Record<string, string>>).map(e => ({
            from: e.from ?? '', to: e.to ?? '',
          })),
        },
      ],
    });
  } else if (Array.isArray(data)) {
    if (isTimelineArray(data)) {
      slides.push({
        layout: 'timeline',
        elements: [
          { type: 'title', text: title },
          {
            type: 'timeline',
            events: data.map((item: Record<string, string>) => ({
              date: item.date, label: item.label,
              ...(item.status ? { status: item.status as 'done' | 'in-progress' | 'planned' } : {}),
            })),
          },
        ],
      });
    } else if (isKPIArray(data)) {
      slides.push({
        layout: 'kpi',
        elements: [
          { type: 'title', text: 'Key Metrics' },
          {
            type: 'kpi',
            indicators: data.map((item: Record<string, string>) => ({
              label: item.label, value: item.value,
              ...(item.unit ? { unit: item.unit } : {}),
              ...(item.trend ? { trend: item.trend as 'up' | 'down' | 'stable' } : {}),
            })),
          },
        ],
      });
    } else {
      slides.push({
        layout: 'bullets',
        elements: [
          { type: 'title', text: 'Data Summary' },
          { type: 'bullets', items: data.slice(0, 10).map(item => JSON.stringify(item)) },
        ],
      });
    }
  }

  return { title, slides };
}
