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

