import { emu } from './xmlHelpers.js';

/** Standard slide canvas boundaries (16:9 slide, 12.192" x 6.858"). */
export const CANVAS = {
  LEFT: emu(0.8),
  RIGHT_NARROW: emu(9.2),
  RIGHT_WIDE: emu(11.4),
  TOP: emu(1.6),
  BOTTOM: emu(6.3),
  BOTTOM_TALL: emu(6.5),
} as const;

/** Standard gaps between elements. */
export const GAP = {
  SMALL: emu(0.1),
  MEDIUM: emu(0.15),
  STANDARD: emu(0.2),
  LARGE: emu(0.35),
  ARROW: emu(0.4),
} as const;

/** Standard row/element heights. */
export const HEIGHT = {
  ROW: emu(0.45),
  HEADER: emu(0.55),
  LINE: emu(0.5),
  LINE_TALL: emu(0.55),
  BAR: emu(1.4),
  BOX: emu(1.6),
} as const;
