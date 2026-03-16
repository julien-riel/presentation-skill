import type { Presentation, Slide } from '../schema/presentation.js';

const DATE_PATTERN = /^\d{4}[-/](Q[1-4]|[01]?\d|[A-Za-z]{3})$/;

const VALID_STATUSES = ['done', 'in-progress', 'planned'] as const;
type TimelineStatus = typeof VALID_STATUSES[number];

function isValidStatus(value: string): value is TimelineStatus {
  return VALID_STATUSES.includes(value as TimelineStatus);
}

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

/**
 * Splits a single CSV line respecting quoted fields.
 * Fields wrapped in double quotes can contain commas and escaped quotes ("").
 */
function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function splitCSV(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitCSVLine(lines[0]);
  const rows = lines.slice(1).map(l => splitCSVLine(l));
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
            ...(statusColIdx >= 0 && row[statusColIdx] && isValidStatus(row[statusColIdx].trim())
              ? { status: row[statusColIdx].trim() as TimelineStatus }
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
          nodes: (data.nodes as Array<Record<string, unknown>>).map(n => ({
            id: String(n.id ?? ''), label: String(n.label ?? ''),
            ...(n.layer ? { layer: String(n.layer) } : {}),
          })),
          edges: (data.edges as Array<Record<string, unknown>>).map(e => ({
            from: String(e.from ?? ''), to: String(e.to ?? ''),
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
            events: data.map((item: Record<string, unknown>) => ({
              date: String(item.date ?? ''), label: String(item.label ?? ''),
              ...(typeof item.status === 'string' && isValidStatus(item.status) ? { status: item.status as TimelineStatus } : {}),
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
            indicators: data.map((item: Record<string, unknown>) => ({
              label: String(item.label ?? ''), value: String(item.value ?? ''),
              ...(item.unit ? { unit: String(item.unit) } : {}),
              ...(typeof item.trend === 'string' ? { trend: item.trend as 'up' | 'down' | 'stable' } : {}),
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
