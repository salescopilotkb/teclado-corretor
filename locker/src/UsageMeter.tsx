/** Medidor de espaço do menu lateral (o mesmo da tela Locker do app). */
import React from 'react';
import { formatBytes, LOCKER_PLANS } from '../../src/files/limits';
import { getLanguage, t } from '../../src/i18n';
import type { Usage } from './data';

export function UsageMeter({ usage }: { usage: Usage | null }) {
  if (!usage) return <div className="usage" aria-hidden="true" />;
  const lang = getLanguage();
  const pct = usage.limit ? Math.min(100, (usage.used / usage.limit) * 100) : 0;
  const full = pct >= 90;
  return (
    <div className="usage">
      <div
        className={`usage-bar ${full ? 'full' : ''}`}
        role="progressbar"
        aria-label={t('Espaço usado')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}>
        <span style={{ width: `${Math.max(pct, usage.used ? 1.5 : 0)}%` }} />
      </div>
      <p className="usage-text">
        {usage.limit
          ? t('{used} de {total} usados', { used: formatBytes(usage.used, lang), total: formatBytes(usage.limit, lang) })
          : t('{used} usados', { used: formatBytes(usage.used, lang) })}
      </p>
      <p className="usage-plan">
        {t('Plano {plan}', { plan: LOCKER_PLANS[usage.plan].name })}
        {full ? <span className="usage-warn"> · {t('quase cheio')}</span> : null}
      </p>
    </div>
  );
}
