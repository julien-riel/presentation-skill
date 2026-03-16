/**
 * Maps status strings to theme accent colors with sensible defaults.
 * Shared by timeline and roadmap drawers.
 */
export function statusColor(status: string, accents: string[]): string {
  switch (status) {
    case 'done': return accents[3] ?? '27AE60';         // accent4 or green
    case 'in-progress': return accents[4] ?? 'F39C12';  // accent5 or amber
    default: return accents.length > 2 ? accents[2] : '999999'; // accent3 or gray
  }
}
