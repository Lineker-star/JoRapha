import { describe, expect, it } from 'vitest';

import { createI18n } from './createI18n';

describe('patient app i18n', () => {
  it('translates the hello screen in French', () => {
    const i18n = createI18n('fr');
    expect(i18n.t('mobile.patient.title')).toBe('Bonjour !');
  });

  it('translates the hello screen in English', () => {
    const i18n = createI18n('en');
    expect(i18n.t('mobile.patient.title')).toBe('Hello!');
  });

  it('switches language at runtime', async () => {
    const i18n = createI18n('fr');
    await i18n.changeLanguage('en');
    expect(i18n.t('mobile.switchLanguage')).toBe('Passer en français');
  });
});
