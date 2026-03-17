import { describe, it, expect } from 'vitest';
import { getDefaultCurrencySymbol, getOoxmlLang } from '../../src/renderer/locale.js';

describe('getDefaultCurrencySymbol', () => {
  it('returns $ when locale is undefined', () => {
    expect(getDefaultCurrencySymbol()).toBe('$');
  });

  it('returns $ for en-US', () => {
    expect(getDefaultCurrencySymbol('en-US')).toBe('$');
  });

  it('returns € for fr-FR', () => {
    expect(getDefaultCurrencySymbol('fr-FR')).toBe('€');
  });

  it('returns € for fr (language-only)', () => {
    expect(getDefaultCurrencySymbol('fr')).toBe('€');
  });

  it('returns ¥ for ja-JP', () => {
    expect(getDefaultCurrencySymbol('ja-JP')).toBe('¥');
  });

  it('returns £ for en-GB', () => {
    expect(getDefaultCurrencySymbol('en-GB')).toBe('£');
  });

  it('returns R$ for pt-BR', () => {
    expect(getDefaultCurrencySymbol('pt-BR')).toBe('R$');
  });

  it('returns $ for unknown locale', () => {
    expect(getDefaultCurrencySymbol('xx-YY')).toBe('$');
  });
});

describe('getOoxmlLang', () => {
  it('returns en-US when locale is undefined', () => {
    expect(getOoxmlLang()).toBe('en-US');
  });

  it('passes through BCP 47 tags with region (fr-FR)', () => {
    expect(getOoxmlLang('fr-FR')).toBe('fr-FR');
  });

  it('maps fr to fr-FR', () => {
    expect(getOoxmlLang('fr')).toBe('fr-FR');
  });

  it('maps ja to ja-JP', () => {
    expect(getOoxmlLang('ja')).toBe('ja-JP');
  });

  it('maps en to en-US', () => {
    expect(getOoxmlLang('en')).toBe('en-US');
  });
});
