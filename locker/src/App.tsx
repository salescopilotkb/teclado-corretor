/**
 * Locker web: confere a sessão (a mesma conta do app) e abre o Locker ou a entrada.
 * Quem chega pelo botão "Abrir" do app já vem com a sessão no endereço.
 * Quem chega pelo link de "Esqueci a senha" cria a senha nova antes de entrar.
 */
import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { t } from '../../src/i18n';
import { fetchPlan, supabase } from './data';
import { PlanGate } from './PlanGate';
import { OPEN } from '../../src/plans/planInfo';
import type { PlanInfo } from '../../src/plans/planInfo';
import { Drive } from './Drive';
import { Login } from './Login';
import { DEMO_USER, PREVIEW } from './demo';
import { useLanguage } from '../../src/i18n/useLanguage';
import { applyProfileLanguage } from './lang';
import { PublicPage, publicRoute } from './Public';

/** /f/<código> ou /d/<código>: página pública, sem login. */
const route = publicRoute();

// Lido antes do Supabase limpar o endereço
const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
const query = new URLSearchParams(location.search);
/** Chegou pelo link de redefinir a senha. */
const cameToReset = hash.get('type') === 'recovery';
/** O link do e-mail venceu ou já foi usado. */
const linkExpired = !!hash.get('error_code') && query.has('redefinir');

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [resetting, setResetting] = useState(cameToReset);
  /** O plano da conta: o que pode usar aqui (grátis e dependente bloqueado não usam o Locker web). */
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  // Troca de idioma: a página toda redesenha
  useLanguage();

  // Entrou: o idioma do perfil (o mesmo do app), se não escolheu outro na página
  const userId = session?.user.id;
  useEffect(() => {
    if (userId) applyProfileLanguage(userId);
    setPlan(null);
    if (userId) fetchPlan().then(setPlan).catch(() => setPlan(OPEN));
  }, [userId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setResetting(true);
      // Tira o token do endereço depois de entrar (não fica no histórico)
      if (s && location.hash.includes('access_token')) history.replaceState(null, '', location.pathname + location.search);
    });
    if (linkExpired) history.replaceState(null, '', location.pathname);
    return () => data.subscription.unsubscribe();
  }, []);

  if (route) return <PublicPage route={route} />;

  // Prévia com o Locker de exemplo (só no desenvolvimento: ?preview, ?preview=entrar, ?preview=senha,
  // ?preview=gratis, ?preview=empresa, ?preview=limite)
  if (PREVIEW) {
    const which = query.get('preview');
    if (which === 'entrar') return <Login />;
    if (which === 'senha') return <Login initialMode="reset" />;
    if (which === 'gratis') return <PlanGate kind="free" company="" userId={DEMO_USER.id} />;
    const demoSession = { user: { id: DEMO_USER.id, email: DEMO_USER.email } } as Session;
    if (which === 'empresa') return <Drive session={demoSession} plan={{ ...OPEN, role: 'dependent', companyName: 'Loja Central' }} />;
    if (which === 'limite') {
      const since = new Date(Date.now() - 12 * 86400000).toISOString();
      return <Drive session={demoSession} plan={{ ...OPEN, status: 'expired', overLimit: true, overLimitSince: since }} />;
    }
    return <Drive session={demoSession} plan={OPEN} />;
  }
  if (session === undefined || (session && !resetting && !plan)) {
    return (
      <div className="splash" aria-busy="true">
        <span className="spinner" />
        <span className="sr-only">{t('Carregando…')}</span>
      </div>
    );
  }
  if (session && resetting) {
    return (
      <Login
        initialMode="reset"
        onReset={() => {
          setResetting(false);
          history.replaceState(null, '', '/');
        }}
      />
    );
  }
  if (!session) return <Login initialMode={linkExpired ? 'forgot' : 'signin'} expired={linkExpired} />;
  if (plan!.status === 'blocked') return <PlanGate kind="blocked" company={plan!.companyName} userId={session.user.id} />;
  // Plano grátis: os 3 arquivos ficam no app e no teclado
  if (plan!.role === 'owner' && plan!.status !== 'open' && !plan!.limits.locker) {
    return <PlanGate kind="free" company="" userId={session.user.id} />;
  }
  return <Drive session={session} plan={plan!} />;
}
