/**
 * No lugar do Locker web quando a conta não pode usar o Locker no computador:
 *  - free: o plano grátis guarda os 3 arquivos só no app e no teclado;
 *  - blocked: dependente com a assinatura da empresa vencida (nada foi apagado).
 * A assinatura é feita no app (só pelas lojas).
 */
import React from 'react';
import { t } from '../../src/i18n';
import { clearOffline } from './offline';
import { supabase } from './data';

export function PlanGate({ kind, company, userId }: { kind: 'free' | 'blocked'; company: string; userId: string }) {
  return (
    <main className="login gate">
      <section className="login-side">
        <div className="login-card">
          <div className="login-head">
            <img src="/k-mark.png" alt="KEYCON" width={36} height={36} className="login-mark" />
            <h1>{kind === 'free' ? t('O Locker no computador está nos planos pagos') : t('Seu acesso está pausado')}</h1>
            <p className="muted">
              {kind === 'free'
                ? t('No plano grátis, seus 3 arquivos ficam no app e no teclado. Para usar o Locker no computador, assine no app KEYCON: Conta › Plano e assinatura.')
                : company
                  ? t('A assinatura de {company} venceu. Seu acesso volta assim que a empresa renovar. Nada foi apagado.', { company })
                  : t('A assinatura da sua empresa venceu. Seu acesso volta assim que a empresa renovar. Nada foi apagado.')}
            </p>
          </div>
          <button className="btn primary big" onClick={() => clearOffline(userId).finally(() => supabase.auth.signOut())}>
            {t('Sair')}
          </button>
        </div>
      </section>
    </main>
  );
}
