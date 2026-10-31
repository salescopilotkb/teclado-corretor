/** Troca de idioma do Locker web (na entrada e no menu da conta). */
import React from 'react';
import { LANGUAGES, t } from '../../src/i18n';
import { useLanguage } from '../../src/i18n/useLanguage';
import { Icon } from './icons';
import { chooseLanguage } from './lang';

export function LanguagePicker({ compact }: { compact?: boolean }) {
  const lang = useLanguage();
  return (
    <label className={`lang-picker ${compact ? 'compact' : ''}`}>
      <Icon name="globe" size={18} />
      <span className="sr-only">{t('Idioma')}</span>
      <select value={lang} onChange={e => chooseLanguage(e.target.value as typeof lang)} aria-label={t('Idioma')}>
        {LANGUAGES.map(l => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
      <Icon name="down" size={16} />
    </label>
  );
}
