import type { Slide, Element } from '../schema/presentation.js';
import {
  MAX_BULLETS,
  MAX_WORDS_PER_BULLET,
  MAX_TITLE_CHARS,
  MAX_KPI_INDICATORS,
  MAX_TABLE_ROWS,
  MAX_TABLE_COLS,
  MAX_CHART_CATEGORIES,
  MAX_CHART_SERIES,
  MAX_DIAGRAM_NODES,
  MAX_TIMELINE_EVENTS,
} from '../schema/constraints.js';

export {
  MAX_BULLETS,
  MAX_WORDS_PER_BULLET,
  MAX_TITLE_CHARS,
  MAX_KPI_INDICATORS,
  MAX_TABLE_ROWS,
  MAX_TABLE_COLS,
  MAX_CHART_CATEGORIES,
  MAX_CHART_SERIES,
  MAX_DIAGRAM_NODES,
  MAX_TIMELINE_EVENTS,
};

/**
 * Counts words in a string (split by whitespace).
 */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Truncates a string to a maximum number of words, appending "…" if truncated.
 */
function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

/**
 * Truncates a string to a maximum number of characters, appending "…" if truncated.
 */
function truncateChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
}

/**
 * Validates and adjusts content for a single slide.
 * - Bullets > MAX_BULLETS → splits into multiple slides with "(1/N)" suffixes.
 * - Bullet text > MAX_WORDS_PER_BULLET → truncated with warning.
 * - Title > MAX_TITLE_CHARS → truncated with ellipsis + warning.
 *
 * Returns an array of slides (1 if no split needed, N if bullets were split).
 */
export function validateSlideContent(slide: Slide): Slide[] {
  const warnings: string[] = [...(slide._warnings ?? [])];
  let elements = [...slide.elements];

  // --- Title truncation ---
  elements = elements.map((el) => {
    if (el.type === 'title' && el.text.length > MAX_TITLE_CHARS) {
      warnings.push(`Title truncated: "${el.text.slice(0, 30)}…"`);
      return { ...el, text: truncateChars(el.text, MAX_TITLE_CHARS) };
    }
    return el;
  });

  // --- Bullet word truncation ---
  elements = elements.map((el) => {
    if (el.type !== 'bullets') return el;
    const newItems = el.items.map((item) => {
      if (wordCount(item) > MAX_WORDS_PER_BULLET) {
        warnings.push(`Bullet truncated: "${item.slice(0, 30)}…"`);
        return truncateWords(item, MAX_WORDS_PER_BULLET);
      }
      return item;
    });
    return { ...el, items: newItems };
  });

  // --- KPI indicator limit ---
  elements = elements.map((el) => {
    if (el.type !== 'kpi') return el;
    if (el.indicators.length > MAX_KPI_INDICATORS) {
      warnings.push(`KPI indicators truncated from ${el.indicators.length} to ${MAX_KPI_INDICATORS}`);
      return { ...el, indicators: el.indicators.slice(0, MAX_KPI_INDICATORS) };
    }
    return el;
  });

  // --- Table row/column limit ---
  elements = elements.map((el) => {
    if (el.type !== 'table') return el;
    let headers = el.headers;
    let rows = el.rows;

    if (headers.length > MAX_TABLE_COLS) {
      warnings.push(`Table columns truncated from ${headers.length} to ${MAX_TABLE_COLS}`);
      headers = headers.slice(0, MAX_TABLE_COLS);
      rows = rows.map(row => row.slice(0, MAX_TABLE_COLS));
    }
    if (rows.length > MAX_TABLE_ROWS) {
      warnings.push(`Table rows truncated from ${rows.length} to ${MAX_TABLE_ROWS}`);
      rows = rows.slice(0, MAX_TABLE_ROWS);
    }

    if (headers !== el.headers || rows !== el.rows) {
      return { ...el, headers, rows };
    }
    return el;
  });

  // --- Chart: max 1 per slide ---
  const chartElements = elements.filter(el => el.type === 'chart');
  if (chartElements.length > 1) {
    warnings.push(`Multiple chart elements reduced to 1`);
    let kept = false;
    elements = elements.filter(el => {
      if (el.type !== 'chart') return true;
      if (!kept) { kept = true; return true; }
      return false;
    });
  }

  // --- Chart category/series limit ---
  elements = elements.map((el) => {
    if (el.type !== 'chart') return el;
    let { labels, series } = el.data;

    // Guard: empty chart data
    if (labels.length === 0 || series.length === 0) {
      warnings.push('Chart has no data, skipping');
      return el;
    }

    if (series.length > MAX_CHART_SERIES) {
      warnings.push(`Chart series truncated from ${series.length} to ${MAX_CHART_SERIES}`);
      series = series.slice(0, MAX_CHART_SERIES);
    }

    if ((el.chartType === 'pie' || el.chartType === 'donut') && series.length > 1) {
      warnings.push(`${el.chartType} chart reduced to single series`);
      series = [series[0]];
    }

    if (labels.length > MAX_CHART_CATEGORIES) {
      warnings.push(`Chart categories truncated from ${labels.length} to ${MAX_CHART_CATEGORIES}`);
      labels = labels.slice(0, MAX_CHART_CATEGORIES);
      series = series.map(s => ({ ...s, values: s.values.slice(0, MAX_CHART_CATEGORIES) }));
    }

    series = series.map(s => {
      if (s.values.length < labels.length) {
        return { ...s, values: [...s.values, ...Array(labels.length - s.values.length).fill(0)] };
      }
      if (s.values.length > labels.length) {
        return { ...s, values: s.values.slice(0, labels.length) };
      }
      return s;
    });

    // Sanitize NaN/Infinity values
    series = series.map(s => ({
      ...s,
      values: s.values.map(v => {
        if (!Number.isFinite(v)) {
          warnings.push(`Non-finite value in series "${s.name}" replaced with 0`);
          return 0;
        }
        return v;
      }),
    }));

    // Guard: negative values in pie/donut charts
    if (el.chartType === 'pie' || el.chartType === 'donut') {
      series = series.map(s => ({
        ...s,
        values: s.values.map(v => {
          if (v < 0) {
            warnings.push('Negative value in pie/donut series replaced with 0');
            return 0;
          }
          return v;
        }),
      }));
    }

    return { ...el, data: { labels, series } };
  });

  // --- Diagram node limit + self-referencing edge guard ---
  elements = elements.map((el) => {
    if (el.type !== 'diagram') return el;

    // Guard: remove self-referencing edges
    const filteredEdges = el.edges.filter(e => e.from !== e.to);
    if (filteredEdges.length < el.edges.length) {
      warnings.push('Self-referencing edge removed');
    }
    el = { ...el, edges: filteredEdges };

    if (el.nodes.length > MAX_DIAGRAM_NODES) {
      warnings.push(`Diagram nodes truncated from ${el.nodes.length} to ${MAX_DIAGRAM_NODES}`);
      const kept = el.nodes.slice(0, MAX_DIAGRAM_NODES);
      const keptIds = new Set(kept.map(n => n.id));
      const edges = el.edges.filter(e => keptIds.has(e.from) && keptIds.has(e.to));
      return { ...el, nodes: kept, edges };
    }
    return el;
  });

  // --- Timeline event limit ---
  elements = elements.map((el) => {
    if (el.type !== 'timeline') return el;
    if (el.events.length > MAX_TIMELINE_EVENTS) {
      warnings.push(`Timeline events truncated from ${el.events.length} to ${MAX_TIMELINE_EVENTS}`);
      return { ...el, events: el.events.slice(0, MAX_TIMELINE_EVENTS) };
    }
    return el;
  });

  // --- Bullet count split ---
  const bulletsElement = elements.find(
    (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
  );

  if (bulletsElement && bulletsElement.items.length > MAX_BULLETS) {
    const nonBulletElements = elements.filter((el) => el.type !== 'bullets');
    const titleElement = elements.find((el) => el.type === 'title');
    const allItems = bulletsElement.items;
    const totalSlides = Math.ceil(allItems.length / MAX_BULLETS);
    const result: Slide[] = [];

    for (let i = 0; i < totalSlides; i++) {
      const chunk = allItems.slice(i * MAX_BULLETS, (i + 1) * MAX_BULLETS);
      const splitIndex = `(${i + 1}/${totalSlides})`;

      // Build title with split index
      const slideElements: Element[] = [];
      if (titleElement && titleElement.type === 'title') {
        slideElements.push({ ...titleElement, text: `${titleElement.text} ${splitIndex}` });
      }
      // Add non-title, non-bullets elements only on first slide
      if (i === 0) {
        for (const el of nonBulletElements) {
          if (el.type !== 'title') slideElements.push(el);
        }
      }
      slideElements.push({ ...bulletsElement, items: chunk });

      result.push({
        ...slide,
        elements: slideElements,
        _splitIndex: splitIndex,
        _warnings: i === 0 ? warnings : [],
      });
    }

    return result;
  }

  return [{ ...slide, elements, _warnings: warnings }];
}

/**
 * Validates content for all slides, potentially expanding into more slides.
 */
export function validateContent(slides: Slide[]): Slide[] {
  return slides.flatMap(validateSlideContent);
}
