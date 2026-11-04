/**
 * Convite para a equipe de uma empresa: locker.keyconapp.com/convite/<código> (sem
 * login). Mostra quem convidou e o e-mail convidado; a pessoa cria a PRÓPRIA senha
 * (a empresa nunca vê), confirma que tem 18 anos ou mais e a conta nasce na equipe.
 * Depois entra direto no Locker e é avisada para baixar o app KEYCON.
 * Quem cria e confere é a função "team-invite" (supabase/functions/team-invite).
 */
import React, { useEffect, useState } from 'react';
import { t } from '../../src/i18n';
import { supabase } from './data';
import { Icon } from './icons';
import { LanguagePicker } from './LanguagePicker';

const MIN_PASSWORD = 8;

/** /convite/<código>: página do convite (null = não é). */
export function inviteRoute(): string | null {
  const m = /^\/convite\/([a-f0-9]{64})\/?$/.exec(location.pathname);
  return m ? m[1] : null;
}

type Info = { company: string; name: string; email: string; expires_at: string };

async function callInvite(body: Record<string, unknown>): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const { data, error } = await supabase.functions.invoke('team-invite', { body });
  if (!error) return { ok: true, data };
  let code = 'error';
  try {
    const reply = await (error as { context?: Response }).context?.json();
    code = String(reply?.error ?? 'error');
  } catch {
    // sem resposta: sem internet
  }
  return { ok: false, error: code };
}

const message = (code: string) => {
  switch (code) {
    case 'invalid_invite':
      return t('Este convite não vale mais: já foi usado, foi cancelado ou passou dos 7 dias. Peça um convite novo para a empresa.');
    case 'company_inactive':
      return t('A empresa está sem um plano com equipe no momento. Fale com ela.');
    case 'plan_limit':
      return t('A equipe da empresa está completa. Fale com ela.');
    case 'email_in_use':
      return t('Este e-mail já tem uma conta KEYCON. Peça à empresa um convite para outro e-mail.');
    case 'weak_password':
      return t('Use pelo menos {n} caracteres.', { n: MIN_PASSWORD });
    default:
      return t('Não foi possível concluir. Verifique a internet e tente de novo.');
  }
};

export function InvitePage({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [fatal, setFatal] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [adult, setAdult] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    callInvite({ action: 'info', token }).then(r => (r.ok ? setInfo(r.data as Info) : setFatal(message(r.error))));
  }, [token]);

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    if (password.length < MIN_PASSWORD) return setError(t('Use pelo menos {n} caracteres.', { n: MIN_PASSWORD }));
    if (password !== confirm) return setError(t('As duas senhas não são iguais.'));
    if (!adult) return setError(t('Para usar o KEYCON é preciso ter 18 anos ou mais.'));
    setBusy(true);
    setError('');
    const r = await callInvite({ action: 'accept', token, password, adult: true });
    if (!r.ok) {
      setBusy(false);
      return setError(message(r.error));
    }
    // Já entra no Locker com a conta nova
    await supabase.auth.signInWithPassword({ email: info.email, password }).catch(() => undefined);
    setBusy(false);
    setDone(true);
  };

  const passwordField = (value: string, set: (v: string) => void, label: string) => (
    <label className="field">
      <span>{label}</span>
      <span className="password-wrap">
        <input type={show ? 'text' : 'password'} autoComplete="new-password" required value={value} onChange={e => set(e.target.value)} />
        <button type="button" className="icon-btn small" aria-label={show ? t('Esconder a senha') : t('Mostrar a senha')} aria-pressed={show} onClick={() => setShow(v => !v)}>
          <Icon name={show ? 'eyeOff' : 'open'} size={18} />
        </button>
      </span>
    </label>
  );

  return (
    <main className="login">
      <section className="login-side">
        <div className="login-card">
          <div className="login-head">
            <img src="/k-mark.png" alt="KEYCON" width={36} height={36} className="login-mark" />
            <h1>{done ? t('Pronto! Você está na equipe') : t('Convite para a equipe')}</h1>
            <p className="muted">
              {fatal
                ? fatal
                : !info
                  ? t('Carregando…')
                  : done
                    ? t('Baixe o app KEYCON no celular e entre com {email} e a senha que você criou. O Locker da empresa também abre aqui, no navegador.', { email: info.email })
                    : info.company
                      ? t('{company} convidou você para vender junto no KEYCON. Crie a sua senha para entrar na equipe.', { company: info.company })
                      : t('Uma empresa convidou você para vender junto no KEYCON. Crie a sua senha para entrar na equipe.')}
            </p>
          </div>

          {done ? (
            <div className="login-form">
              <a className="btn primary big" href="/">
                {t('Abrir o Locker')}
              </a>
              <a className="link-btn center" href="https://keyconapp.com" target="_blank" rel="noreferrer">
                {t('Baixar o app KEYCON')}
              </a>
            </div>
          ) : info && !fatal ? (
            <form onSubmit={accept} className="login-form">
              <label className="field">
                <span>{t('E-mail')}</span>
                <input type="email" value={info.email} readOnly aria-readonly="true" />
              </label>
              {passwordField(password, setPassword, t('Crie a sua senha'))}
              {passwordField(confirm, setConfirm, t('Repita a senha'))}
              <p className="muted small">{t('Pelo menos {n} caracteres. Só você fica sabendo da sua senha.', { n: MIN_PASSWORD })}</p>
              <label className="consent">
                <input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} />
                <span>
                  {t('Tenho 18 anos ou mais e aceito os')}{' '}
                  <a href="https://keyconapp.com/termos.html" target="_blank" rel="noreferrer">
                    {t('Termos de Uso')}
                  </a>{' '}
                  {t('e a')}{' '}
                  <a href="https://keyconapp.com/privacidade.html" target="_blank" rel="noreferrer">
                    {t('Política de Privacidade')}
                  </a>
                  .
                </span>
              </label>
              {error ? <p className="error" role="alert">{error}</p> : null}
              <button className="btn primary big" disabled={busy}>
                {busy ? t('Criando a conta…') : t('Entrar na equipe')}
              </button>
            </form>
          ) : null}
        </div>
        <LanguagePicker />
      </section>
    </main>
  );
}
