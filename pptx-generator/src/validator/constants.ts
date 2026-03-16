import type { LayoutType } from '../schema/presentation.js';

// --- Layout constants ---

export const LAYOUT_PPT_NAME_TO_TYPE: Record<string, LayoutType> = {
  LAYOUT_TITLE: 'title',
  LAYOUT_SECTION: 'section',
  LAYOUT_BULLETS: 'bullets',
  LAYOUT_TWO_COLUMNS: 'twoColumns',
  LAYOUT_TIMELINE: 'timeline',
  LAYOUT_ARCHITECTURE: 'architecture',
  LAYOUT_GENERIC: 'generic',
  LAYOUT_CHART: 'chart',
  LAYOUT_TABLE: 'table',
  LAYOUT_KPI: 'kpi',
  LAYOUT_QUOTE: 'quote',
  LAYOUT_IMAGE_TEXT: 'imageText',
  LAYOUT_ROADMAP: 'roadmap',
  LAYOUT_PROCESS: 'process',
  LAYOUT_COMPARISON: 'comparison',
};

export const LAYOUT_TYPE_TO_PPT_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(LAYOUT_PPT_NAME_TO_TYPE).map(([k, v]) => [v, k])
);

export const KNOWN_LAYOUT_PPT_NAMES = Object.keys(LAYOUT_PPT_NAME_TO_TYPE);

export const ALL_LAYOUT_TYPES: LayoutType[] = Object.values(LAYOUT_PPT_NAME_TO_TYPE);

export const TIER1_LAYOUTS: LayoutType[] = ['title', 'section', 'bullets', 'generic'];
export const TIER2_LAYOUTS: LayoutType[] = [...TIER1_LAYOUTS, 'twoColumns', 'timeline'];

export const FALLBACK_CASCADES: Record<string, LayoutType[]> = {
  kpi: ['bullets', 'generic'],
  chart: ['bullets', 'generic'],
  table: ['bullets', 'generic'],
  quote: ['bullets', 'generic'],
  architecture: ['bullets', 'generic'],
  imageText: ['twoColumns', 'bullets', 'generic'],
  roadmap: ['timeline', 'bullets', 'generic'],
  process: ['timeline', 'bullets', 'generic'],
  comparison: ['twoColumns', 'bullets', 'generic'],
};
