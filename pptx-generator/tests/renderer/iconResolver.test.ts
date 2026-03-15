import { describe, it, expect } from 'vitest';
import { resolveIcon, createIconCache } from '../../src/renderer/iconResolver.js';

describe('resolveIcon', () => {
  it('resolves a known Lucide icon to a PNG buffer', async () => {
    const cache = createIconCache();
    const result = await resolveIcon('database', '2D7DD2', 32, cache);
    expect(result).not.toBeNull();
    expect(result!.pngBuffer).toBeInstanceOf(Buffer);
    expect(result!.pngBuffer.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(result!.pngBuffer[0]).toBe(0x89);
    expect(result!.pngBuffer[1]).toBe(0x50);
    expect(result!.pngBuffer[2]).toBe(0x4E);
    expect(result!.pngBuffer[3]).toBe(0x47);
    expect(result!.widthPx).toBe(32);
    expect(result!.heightPx).toBe(32);
  });

  it('returns null for an unknown icon name', async () => {
    const cache = createIconCache();
    const result = await resolveIcon('nonexistent-icon-xyz', 'FF0000', 32, cache);
    expect(result).toBeNull();
  });

  it('applies the requested color to the SVG', async () => {
    const cache = createIconCache();
    const red = await resolveIcon('circle', 'FF0000', 32, cache);
    const blue = await resolveIcon('circle', '0000FF', 32, cache);
    expect(red).not.toBeNull();
    expect(blue).not.toBeNull();
    expect(red!.pngBuffer.equals(blue!.pngBuffer)).toBe(false);
  });

  it('caches results for the same name+color+size', async () => {
    const cache = createIconCache();
    const first = await resolveIcon('database', '2D7DD2', 32, cache);
    const second = await resolveIcon('database', '2D7DD2', 32, cache);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.pngBuffer).toBe(second!.pngBuffer);
  });

  it('produces different cache entries for different sizes', async () => {
    const cache = createIconCache();
    const small = await resolveIcon('database', '2D7DD2', 20, cache);
    const large = await resolveIcon('database', '2D7DD2', 48, cache);
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    expect(small!.pngBuffer.equals(large!.pngBuffer)).toBe(false);
  });
});
