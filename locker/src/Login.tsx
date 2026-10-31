/**
 * Entrada do Locker web: só "Entrar" e "Esqueci a senha" (a conta é criada no app
 * KEYCON; aqui não tem cadastro).
 *
 * Esqueci a senha: manda o link do Supabase para o e-mail; o link volta para cá e a
 * pessoa cria a senha nova (App.tsx abre esta tela no modo "reset"). A senha nova
 * vale também no app. Por segurança, a mensagem é a mesma exista ou não a conta.
 */
import React, { useEffect, useRef, useState } from 'react';
import { t } from '../../src/i18n';
import { LOCKER_URL, supabase } from './data';
import { Icon } from './icons';
import { LanguagePicker } from './LanguagePicker';

type Mode = 'signin' | 'forgot' | 'sent' | 'reset';

const MIN_PASSWORD = 6;

/** Mensagem clara para cada erro do Supabase. */
function friendly(error: { message?: string; status?: number } | null): string {
  const text = (error?.message ?? '').toLowerCase();
  if (!navigator.onLine) return t('Sem internet. Confira a conexão e tente de novo.');
  if (text.includes('invalid login') || text.includes('invalid credentials')) return t('E-mail ou senha incorretos.');
  if (text.includes('email not confirmed')) return t('Confirme seu e-mail pelo link que enviamos quando você criou a conta no app.');
  if (error?.status === 429 || text.includes('rate limit') || text.includes('security purposes')) return t('Muitas tentativas. Espere um minuto e tente de novo.');
  if (text.includes('same password') || text.includes('different from the old')) return t('A senha nova precisa ser diferente da atual.');
  if (text.includes('password should be') || text.includes('weak')) return t('Senha fraca. Use pelo menos {n} caracteres, misturando letras e números.', { n: MIN_PASSWORD });
  return t('Não foi possível entrar agora. Tente de novo em instantes.');
}

export function Login({ initialMode = 'signin', onReset, expired }: { initialMode?: Mode; onReset?: () => void; expired?: boolean }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Chegou por um link de senha vencido: avisa até a pessoa pedir outro. */
  const [linkGone, setLinkGone] = useState(!!expired);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError('');
    first.current?.focus();
  }, [mode]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(friendly(err));
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${LOCKER_URL}/?redefinir=1` });
    setBusy(false);
    setLinkGone(false);
    // Conta inexistente também mostra "enviamos": ninguém descobre quais e-mails têm conta
    if (err && (err.status === 429 || !navigator.onLine)) return setError(friendly(err));
    setMode('sent');
  };

  const saveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(t('Use pelo menos {n} caracteres.', { n: MIN_PASSWORD }));
    if (password !== confirm) return setError(t('As duas senhas não são iguais.'));
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(friendly(err));
    onReset?.();
  };

  const passwordField = (value: string, set: (v: string) => void, label: string, autoComplete: string, ref?: React.Ref<HTMLInputElement>) => (
    <label className="field">
      <span>{label}</span>
      <span className="password-wrap">
        <input ref={ref} type={show ? 'text' : 'password'} autoComplete={autoComplete} required value={value} onChange={e => set(e.target.value)} />
        <button type="button" className="icon-btn small" aria-label={show ? t('Esconder a senha') : t('Mostrar a senha')} aria-pressed={show} onClick={() => setShow(v => !v)}>
          <Icon name={show ? 'eyeOff' : 'open'} size={18} />
        </button>
      </span>
    </label>
  );

  return (
    <main className="login">
      {/* Lado da marca (no computador) */}
      <section className="login-brand" aria-hidden="true">
        <div className="login-brand-top">
          <img src="/k-mark.png" alt="" width={40} height={40} />
          <span>Locker</span>
        </div>
        <div className="login-brand-copy">
          <h2>{t('Seus arquivos de venda, em qualquer lugar.')}</h2>
          <ul>
            <li>
              <Icon name="keyboard" size={20} />
              {t('No app, no teclado e no navegador, sempre iguais.')}
            </li>
            <li>
              <Icon name="image" size={20} />
              {t('Fotos e vídeos direto na conversa com o cliente.')}
            </li>
            <li>
              <Icon name="team" size={20} />
              {t('Compartilhe pastas com a sua equipe.')}
            </li>
          </ul>
        </div>
        <img className="login-brand-logo" src="/logo-keycon.png" alt="" />
      </section>

      {/* Formulário */}
      <section className="login-side">
        <div className="login-card">
          <div className="login-head">
            <img src="/k-mark.png" alt="KEYCON" width={36} height={36} className="login-mark" />
            <h1>
              {mode === 'signin'
                ? t('Entrar no Locker')
                : mode === 'forgot'
                  ? t('Esqueci a senha')
                  : mode === 'sent'
                    ? t('Confira seu e-mail')
                    : t('Crie uma senha nova')}
            </h1>
            <p className="muted">
              {mode === 'signin'
                ? t('Use a mesma conta do app KEYCON.')
                : mode === 'forgot'
                  ? t('Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.')
                  : mode === 'sent'
                    ? t('Se existir uma conta com {email}, o link para criar a senha nova chega em alguns minutos. Olhe também a caixa de spam.', { email: email.trim() })
                    : t('A senha nova vale no Locker e no app.')}
            </p>
          </div>

          {linkGone && mode === 'forgot' ? (
            <p className="notice" role="status">
              {t('Esse link já venceu ou já foi usado. Peça um novo abaixo.')}
            </p>
          ) : null}

          {mode === 'signin' ? (
            <form onSubmit={signIn} className="login-form">
              <label className="field">
                <span>{t('E-mail')}</span>
                <input ref={first} type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} />
              </label>
              {passwordField(password, setPassword, t('Senha'), 'current-password')}
              <button type="button" className="link-btn" onClick={() => setMode('forgot')}>
                {t('Esqueci a senha')}
              </button>
              {error ? <p className="error" role="alert">{error}</p> : null}
              <button className="btn primary big" disabled={busy}>
                {busy ? t('Entrando…') : t('Entrar')}
              </button>
            </form>
          ) : mode === 'forgot' ? (
            <form onSubmit={sendReset} className="login-form">
              <label className="field">
                <span>{t('E-mail')}</span>
                <input ref={first} type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} />
              </label>
              {error ? <p className="error" role="alert">{error}</p> : null}
              <button className="btn primary big" disabled={busy}>
                {busy ? t('Enviando…') : t('Enviar o link')}
              </button>
              <button type="button" className="link-btn center" onClick={() => setMode('signin')}>
                {t('Voltar para Entrar')}
              </button>
            </form>
          ) : mode === 'sent' ? (
            <div className="login-form">
              <div className="login-sent" aria-hidden="true">
                <Icon name="check" size={28} />
              </div>
              <button className="btn primary big" onClick={() => setMode('signin')}>
                {t('Voltar para Entrar')}
              </button>
              <button type="button" className="link-btn center" onClick={() => setMode('forgot')}>
                {t('Não chegou? Enviar de novo')}
              </button>
            </div>
          ) : (
            <form onSubmit={saveNewPassword} className="login-form">
              {passwordField(password, setPassword, t('Senha nova'), 'new-password', first)}
              {passwordField(confirm, setConfirm, t('Repita a senha nova'), 'new-password')}
              <p className="muted small">{t('Pelo menos {n} caracteres.', { n: MIN_PASSWORD })}</p>
              {error ? <p className="error" role="alert">{error}</p> : null}
              <button className="btn primary big" disabled={busy}>
                {busy ? t('Salvando…') : t('Salvar e entrar')}
              </button>
            </form>
          )}
        </div>
        <LanguagePicker />
        <p className="login-foot muted">
          {t('Ainda não tem conta? Baixe o app KEYCON e crie a sua por lá.')}{' '}
          <a href="https://keyconapp.com" target="_blank" rel="noreferrer">
            keyconapp.com
          </a>
        </p>
      </section>
    </main>
  );
}
