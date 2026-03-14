/**
 * Professional visual theme constants used across all renderers.
 * Centralized here so every slide type shares a cohesive look.
 */

// ── Color Palette ──────────────────────────────────────────
export const COLORS = {
  /** Dark navy — title slide background, slide titles */
  primary: '1B2A4A',
  /** Vibrant blue — accent bars, active elements, links */
  accent1: '2D7DD2',
  /** Teal — secondary accent, timeline "done" */
  accent2: '17A2B8',
  /** Warm coral — highlights, alerts */
  accent3: 'E8625C',
  /** Green — success, "done" status */
  green: '27AE60',
  /** Amber — "in-progress" status */
  amber: 'F39C12',
  /** Cool gray — planned, secondary text */
  gray: '8395A7',
  /** Light gray — subtle borders, background tints */
  lightGray: 'E8ECF1',
  /** Very light — content slide background tint */
  bgLight: 'F7F9FC',
  /** White */
  white: 'FFFFFF',
  /** Near-black — body text */
  text: '2C3E50',
  /** Medium gray — secondary text, captions */
  textSecondary: '6C7A89',
};

// ── Typography ─────────────────────────────────────────────
export const FONTS = {
  title: 'Calibri Light',
  body: 'Calibri',
};

export const FONT_SIZES = {
  /** Slide title on content slides */
  slideTitle: 28,
  /** Hero title on title/section slides */
  heroTitle: 40,
  /** Subtitle text */
  subtitle: 18,
  /** Body/bullet text */
  body: 16,
  /** Small labels, captions */
  small: 11,
};

// ── Layout Geometry (percentages of slide) ─────────────────
export const LAYOUT = {
  /** Left/right margin for content */
  marginX: '7%',
  /** Content area width */
  contentW: '86%',
  /** Title bar Y position */
  titleY: '4%',
  /** Title bar height */
  titleH: '12%',
  /** Accent bar Y (below title) */
  accentBarY: 1.18,   // inches
  /** Body content starts after title + accent bar */
  bodyY: '20%',
  /** Body content height */
  bodyH: '72%',
};
