/**
 * Information about a single placeholder in a slide layout.
 */
export interface PlaceholderInfo {
  index: number;
  type: string;
  position: {
    x: number;
    y: number;
    cx: number;
    cy: number;
  };
}

/**
 * Information about a slide layout extracted from the .pptx.
 */
export interface LayoutInfo {
  name: string;
  /** Path inside the ZIP, e.g. "ppt/slideLayouts/slideLayout3.xml" */
  filePath: string;
  placeholders: PlaceholderInfo[];
}

/**
 * Theme information extracted from the .pptx.
 */
export interface ThemeInfo {
  titleFont: string;
  bodyFont: string;
  accentColors: string[];
}

/**
 * Complete template information extracted by readTemplate.
 */
export interface TemplateInfo {
  layouts: LayoutInfo[];
  theme: ThemeInfo;
  slideDimensions: {
    widthEmu: number;
    heightEmu: number;
  };
}

// --- Validation types ---

export type Severity = 'ERROR' | 'WARNING' | 'INFO';
export type ValidationStatus = 'pass' | 'fail';

export interface ValidationResult {
  id: string;
  severity: Severity;
  status: ValidationStatus;
  message: string;
  context?: Record<string, unknown>;
}

export interface ValidationRule {
  id: string;
  severity: Severity;
  description: string;
  validate: (template: TemplateInfo) => ValidationResult;
}

// --- Layout constants ---

export const LAYOUT_PPT_NAME_TO_TYPE: Record<string, string> = {
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

export const ALL_LAYOUT_TYPES = [
  'title', 'section', 'bullets', 'twoColumns', 'timeline', 'architecture', 'generic',
  'chart', 'table', 'kpi', 'quote', 'imageText', 'roadmap', 'process', 'comparison',
];

export const TIER1_LAYOUTS = ['title', 'section', 'bullets', 'generic'];
export const TIER2_LAYOUTS = [...TIER1_LAYOUTS, 'twoColumns', 'timeline'];

export const FALLBACK_CASCADES: Record<string, string[]> = {
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
