import type { Slide, Element } from '../schema/presentation.js';

/**
 * Checks if a slide's layout was degraded (original layout differs from resolved).
 */
function isDegraded(slide: Slide): boolean {
  return !!slide._resolvedLayout && slide._resolvedLayout !== slide.layout;
}

/**
 * Converts a chart element to a table element.
 */
function chartToTable(chartEl: Extract<Element, { type: 'chart' }>): Extract<Element, { type: 'table' }> {
  return {
    type: 'table',
    headers: ['', ...chartEl.data.series.map(s => s.name)],
    rows: chartEl.data.labels.map((label, i) =>
      [label, ...chartEl.data.series.map(s => String(s.values[i] ?? 0))]
    ),
  };
}

/**
 * Converts a chart element to bullets.
 */
function chartToBullets(chartEl: Extract<Element, { type: 'chart' }>): Extract<Element, { type: 'bullets' }> {
  const items = chartEl.data.labels.map((label, i) => {
    const values = chartEl.data.series.map(s => `${s.name}: ${s.values[i] ?? 0}`).join(', ');
    return `${label} — ${values}`;
  });
  return { type: 'bullets', items };
}

/**
 * Converts a KPI element to bullets.
 */
function kpiToBullets(kpiEl: Extract<Element, { type: 'kpi' }>): Extract<Element, { type: 'bullets' }> {
  const items = kpiEl.indicators.map(ind => {
    const parts = [ind.label, ind.value];
    if (ind.unit) parts.push(ind.unit);
    if (ind.trend) parts.push(`(${ind.trend})`);
    return parts.join(' — ');
  });
  return { type: 'bullets', items };
}

/**
 * Converts a diagram element to bullets.
 */
function diagramToBullets(diagramEl: Extract<Element, { type: 'diagram' }>): Extract<Element, { type: 'bullets' }> {
  const items = diagramEl.nodes.map(node => {
    const layer = node.layer ? `[${node.layer}] ` : '';
    return `${layer}${node.label}`;
  });
  return { type: 'bullets', items };
}

/**
 * Converts a timeline element to bullets.
 */
function timelineToBullets(timelineEl: Extract<Element, { type: 'timeline' }>): Extract<Element, { type: 'bullets' }> {
  const items = timelineEl.events.map(event => {
    const status = event.status ? ` (${event.status})` : '';
    return `${event.date} — ${event.label}${status}`;
  });
  return { type: 'bullets', items };
}

/**
 * Transforms elements when their layout has been degraded.
 * Called after layoutResolver, before contentValidator.
 *
 * Handles degradation of:
 * - chart → table or bullets
 * - kpi → bullets
 * - diagram → bullets
 * - timeline → bullets (when roadmap/process/timeline degraded)
 */
export function degradeElements(slides: Slide[]): Slide[] {
  return slides.map((slide) => {
    if (!isDegraded(slide)) return slide;

    const resolved = slide._resolvedLayout!;
    let elements = [...slide.elements];

    // Chart degradation: chart → table or chart → bullets
    if (slide.layout === 'chart') {
      const chartEl = elements.find(el => el.type === 'chart');
      if (chartEl && chartEl.type === 'chart') {
        if (resolved === 'table') {
          elements = elements.map(el => el.type === 'chart' ? chartToTable(el as Extract<Element, { type: 'chart' }>) : el);
        } else {
          elements = elements.map(el => el.type === 'chart' ? chartToBullets(el as Extract<Element, { type: 'chart' }>) : el);
        }
      }
    }

    // KPI degradation: kpi → bullets
    if (slide.layout === 'kpi' && resolved !== 'kpi') {
      elements = elements.map(el =>
        el.type === 'kpi' ? kpiToBullets(el as Extract<Element, { type: 'kpi' }>) : el
      );
    }

    // Architecture degradation: diagram → bullets
    if (slide.layout === 'architecture' && resolved !== 'architecture') {
      elements = elements.map(el =>
        el.type === 'diagram' ? diagramToBullets(el as Extract<Element, { type: 'diagram' }>) : el
      );
    }

    // Timeline/roadmap/process degradation: timeline → bullets
    if (
      (slide.layout === 'timeline' || slide.layout === 'roadmap' || slide.layout === 'process') &&
      resolved !== 'timeline' && resolved !== 'roadmap' && resolved !== 'process'
    ) {
      elements = elements.map(el =>
        el.type === 'timeline' ? timelineToBullets(el as Extract<Element, { type: 'timeline' }>) : el
      );
    }

    return { ...slide, elements };
  });
}
