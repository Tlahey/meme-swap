import { describe, it, expect } from 'vitest';

import { getNestedValue } from './index';
import { en } from './locales/en';
import { fr } from './locales/fr';

describe('getNestedValue', () => {
  it('resolves a single-level dotted path', () => {
    expect(getNestedValue(en, 'common.reset')).toBe('Reset');
    expect(getNestedValue(fr, 'common.reset')).toBe('Réinitialiser');
  });

  it('resolves a two-level nested path', () => {
    expect(getNestedValue(en, 'model.presets.title')).toBe('Quality Presets');
  });

  it('resolves a three-level nested path', () => {
    expect(getNestedValue(en, 'process.steps.upload.label')).toBe('Upload & Validation');
    expect(getNestedValue(fr, 'process.steps.inference.desc')).toBe(
      'Détection des repères faciaux et échange de visage.',
    );
  });

  it('falls back to the path itself when the top-level key does not exist', () => {
    expect(getNestedValue(en, 'doesNotExist')).toBe('doesNotExist');
  });

  it('falls back to the path itself when a nested key does not exist', () => {
    expect(getNestedValue(en, 'common.doesNotExist')).toBe('common.doesNotExist');
    expect(getNestedValue(en, 'process.steps.doesNotExist.label')).toBe(
      'process.steps.doesNotExist.label',
    );
  });

  it('falls back to the path itself when the resolved value is an object, not a leaf string', () => {
    // 'process.steps.upload' is itself an object ({ label, desc }), not a string.
    expect(getNestedValue(en, 'process.steps.upload')).toBe('process.steps.upload');
  });

  it('falls back to the path itself when trying to descend past a leaf string', () => {
    // 'common.reset' resolves to the string 'Reset'; continuing to '.extra'
    // tries to index into a string, which the `typeof current === 'object'`
    // guard rejects.
    expect(getNestedValue(en, 'common.reset.extra')).toBe('common.reset.extra');
  });

  it('resolves a real interpolation-bearing value verbatim (interpolation is handled by the caller, not getNestedValue)', () => {
    expect(getNestedValue(en, 'mcp.active')).toBe('Active (Port {port})');
    expect(getNestedValue(en, 'updateBanner.message')).toBe(
      'A new version ({version}) is available.',
    );
  });
});
