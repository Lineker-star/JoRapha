import { describe, expect, it } from 'vitest';

import { createI18n } from './createI18n';

describe('CHW app i18n', () => {
  it('translates the hello screen in French', () => {
    const i18n = createI18n('fr');
    expect(i18n.t('mobile.chw.title')).toBe('Bonjour, agent de santé !');
  });

  it('translates the hello screen in English', () => {
    const i18n = createI18n('en');
    expect(i18n.t('mobile.chw.title')).toBe('Hello, health worker!');
  });

  it('switches language at runtime', async () => {
    const i18n = createI18n('fr');
    await i18n.changeLanguage('en');
    expect(i18n.t('mobile.switchLanguage')).toBe('Passer en français');
  });
});
