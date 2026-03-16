import type { Slide } from '../schema/presentation.js';

/**
 * Transforms elements when their layout has been degraded.
 * Called after layoutResolver, before contentValidator.
 */
export function degradeElements(slides: Slide[]): Slide[] {
  return slides.map((slide) => {
    if (slide.layout !== 'chart' || slide._resolvedLayout === 'chart') return slide;

    const chartEl = slide.elements.find(el => el.type === 'chart');
    if (!chartEl || chartEl.type !== 'chart') return slide;

    if (slide._resolvedLayout === 'table') {
      const tableEl = {
        type: 'table' as const,
        headers: ['', ...chartEl.data.series.map(s => s.name)],
        rows: chartEl.data.labels.map((label, i) =>
          [label, ...chartEl.data.series.map(s => String(s.values[i] ?? 0))]
        ),
      };
      const elements = slide.elements.map(el => el.type === 'chart' ? tableEl : el);
      return { ...slide, elements };
    }

    const items = chartEl.data.labels.map((label, i) => {
      const values = chartEl.data.series.map(s => `${s.name}: ${s.values[i] ?? 0}`).join(', ');
      return `${label} — ${values}`;
    });
    const bulletsEl = { type: 'bullets' as const, items };
    const elements = slide.elements.map(el => el.type === 'chart' ? bulletsEl : el);
    return { ...slide, elements };
  });
}
