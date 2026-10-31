/**
 * "Compartilhar", como no Drive:
 *  - Pessoas e equipes com acesso: por e-mail ou por uma equipe (acesso de leitor:
 *    ver, abrir e baixar). Quem recebe acha em "Compartilhados comigo".
 *  - Acesso geral da pasta: Privada, Qualquer pessoa com o link ou Pública (o mesmo
 *    que o app mostra em "Quem pode ver esta pasta"). Arquivo: o link sempre abre
 *    sem login.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { t } from '../../src/i18n';
import { lockerLink, supabase } from './data';
import type { LockerFile, LockerFolder, Visibility } from './data';
import { Icon } from './icons';
import type { IconName } from './icons';
import { addShare, isEmail, listShares, listTeams, removeShare } from './sharing';
import type { Share, Team } from './sharing';

const OPTIONS: Array<{ id: Visibility; label: string; hint: string; icon: IconName }> = [
  { id: 'private', label: 'Privada', hint: 'Só você e as pessoas e equipes acima.', icon: 'lock' },
  { id: 'link', label: 'Qualquer pessoa com o link', hint: 'Quem tiver o link vê a pasta, sem entrar na conta.', icon: 'link' },
  { id: 'public', label: 'Pública', hint: 'Como "com o link", e também na sua vitrine pública do Locker.', icon: 'globe' },
];

export function ShareDialog({
  target,
  userId,
  userEmail,
  onClose,
  onChanged,
  onCopied,
}: {
  target: { kind: 'folder'; folder: LockerFolder } | { kind: 'file'; file: LockerFile };
  userId: string;
  userEmail: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onCopied: (text: string) => void;
}) {
  const [visibility, setVisibility] = useState<Visibility>(target.kind === 'folder' ? target.folder.visibility ?? 'private' : 'link');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shares, setShares] = useState<Share[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [who, setWho] = useState('');
  const [adding, setAdding] = useState(false);
  const name = (target.kind === 'folder' ? target.folder.name : target.file.name) || t('Sem nome');
  const link = target.kind === 'folder' ? lockerLink('d', target.folder.share_token) : lockerLink('f', target.file.share_token);
  const shareTarget = useMemo(
    () => (target.kind === 'folder' ? { kind: 'folder' as const, id: target.folder.id } : { kind: 'file' as const, id: target.file.id }),
    [target],
  );

  const loadShares = async () => {
    try {
      setShares(await listShares(shareTarget, userId));
    } catch (e) {
      setShares([]);
      setError(e instanceof Error ? e.message : t('Não foi possível carregar quem tem acesso.'));
    }
  };

  useEffect(() => {
    loadShares();
    listTeams()
      .then(setTeams)
      .catch(() => setTeams([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareTarget]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const teamName = (id: string | null) => teams.find(tm => tm.id === id)?.name || t('Equipe');
  const typed = who.trim().toLowerCase();
  const teamMatches = typed ? teams.filter(tm => tm.name.toLowerCase().includes(typed) && !shares?.some(s => s.team_id === tm.id)).slice(0, 4) : [];
  const self = typed === userEmail.toLowerCase();

  const add = async (grantee: { email: string } | { teamId: string }) => {
    setAdding(true);
    setError('');
    try {
      await addShare(shareTarget, grantee);
      setWho('');
      await loadShares();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Não foi possível compartilhar.'));
    } finally {
      setAdding(false);
    }
  };
  const submitWho = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamMatches.length === 1 && !isEmail(typed)) return add({ teamId: teamMatches[0].id });
    if (!isEmail(typed)) return setError(t('Digite um e-mail válido ou escolha uma equipe.'));
    if (self) return setError(t('Você já é o dono.'));
    add({ email: typed });
  };
  const remove = async (s: Share) => {
    setError('');
    try {
      await removeShare(s.id);
      await loadShares();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Não foi possível tirar o acesso.'));
    }
  };

  const choose = async (v: Visibility) => {
    if (target.kind !== 'folder' || v === visibility) return;
    const before = visibility;
    setVisibility(v);
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('locker_folders').update({ visibility: v }).eq('id', target.folder.id);
    setSaving(false);
    if (err) {
      setVisibility(before);
      setError(t('Não foi possível salvar. Confira a internet e tente de novo.'));
    } else onChanged();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      onCopied(t('Link copiado'));
    } catch {
      setError(t('Não foi possível copiar. Selecione o link e copie à mão.'));
    }
  };

  return (
    <div className="dialog-layer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">{t('Compartilhar "{name}"', { name })}</h2>

        {/* Pessoas e equipes */}
        <form className="share-add" onSubmit={submitWho}>
          <input
            value={who}
            onChange={e => setWho(e.target.value)}
            placeholder={t('Adicionar e-mail ou equipe')}
            aria-label={t('Adicionar e-mail ou equipe')}
            autoComplete="email"
            inputMode="email"
          />
          <button className="btn primary" disabled={adding || !typed}>
            {t('Compartilhar')}
          </button>
        </form>
        {teamMatches.length ? (
          <ul className="share-suggest" aria-label={t('Equipes')}>
            {teamMatches.map(tm => (
              <li key={tm.id}>
                <button onClick={() => add({ teamId: tm.id })}>
                  <span className="share-icon">
                    <Icon name="team" size={18} />
                  </span>
                  <span className="share-text">
                    <span className="share-label">{tm.name || t('Equipe sem nome')}</span>
                    <span className="muted">{tm.members.length === 1 ? t('1 pessoa') : t('{n} pessoas', { n: tm.members.length })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <section className="share-people" aria-label={t('Pessoas e equipes com acesso')}>
          <h3>{t('Pessoas e equipes com acesso')}</h3>
          <ul>
            <li className="share-person">
              <span className="avatar small">{(userEmail[0] || '?').toUpperCase()}</span>
              <span className="share-text">
                <span className="share-label">{t('{email} (você)', { email: userEmail })}</span>
              </span>
              <span className="muted share-role">{t('Dono')}</span>
            </li>
            {shares === null ? (
              <li className="share-person muted">{t('Carregando…')}</li>
            ) : (
              shares.map(s => (
                <li key={s.id} className="share-person">
                  {s.team_id ? (
                    <span className="share-icon">
                      <Icon name="team" size={18} />
                    </span>
                  ) : (
                    <span className="avatar small soft">{(s.grantee_email?.[0] || '?').toUpperCase()}</span>
                  )}
                  <span className="share-text">
                    <span className="share-label">{s.team_id ? teamName(s.team_id) : s.grantee_email}</span>
                    {s.team_id ? <span className="muted">{t('Equipe')}</span> : null}
                  </span>
                  <span className="muted share-role">{t('Leitor')}</span>
                  <button className="icon-btn small" aria-label={t('Tirar o acesso de {who}', { who: s.team_id ? teamName(s.team_id) : s.grantee_email ?? '' })} title={t('Tirar o acesso')} onClick={() => remove(s)}>
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))
            )}
          </ul>
          <p className="muted share-note">
            {t('Leitores veem, abrem e baixam. Eles acham em "Compartilhados comigo" ao entrar no Locker com esse e-mail.')}
          </p>
        </section>

        {/* Acesso geral */}
        {target.kind === 'folder' ? (
          <fieldset className="share-access" disabled={saving}>
            <legend>{t('Acesso geral')}</legend>
            {OPTIONS.map(o => (
              <label key={o.id} className={`share-option ${visibility === o.id ? 'on' : ''}`}>
                <input type="radio" name="visibility" checked={visibility === o.id} onChange={() => choose(o.id)} />
                <span className="share-icon">
                  <Icon name={o.icon} size={18} />
                </span>
                <span className="share-text">
                  <span className="share-label">{t(o.label)}</span>
                  <span className="muted">{t(o.hint)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="share-option on static">
            <span className="share-icon">
              <Icon name="link" size={18} />
            </span>
            <span className="share-text">
              <span className="share-label">{t('Qualquer pessoa com o link')}</span>
              <span className="muted">{t('Quem tiver o link abre este arquivo, sem entrar na conta. Só quem você mandar o link fica sabendo dele.')}</span>
            </span>
          </div>
        )}

        {target.kind === 'file' || visibility !== 'private' ? (
          <div className="share-link">
            <input readOnly value={link} aria-label={t('Link')} onFocus={e => e.currentTarget.select()} />
          </div>
        ) : null}
        {error ? <p className="error" role="alert">{error}</p> : null}

        <div className="dialog-actions spread">
          <button className="btn" disabled={target.kind === 'folder' && visibility === 'private'} onClick={copy}>
            <Icon name="link" size={18} />
            {t('Copiar link')}
          </button>
          <button className="btn primary" onClick={onClose}>
            {t('Concluído')}
          </button>
        </div>
      </div>
    </div>
  );
}
