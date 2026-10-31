/**
 * "Equipes": grupos de e-mails para compartilhar de uma vez (ex.: "Vendas loja 2").
 * Quem entra na equipe passa a ver tudo o que foi compartilhado com ela; quem sai
 * deixa de ver. As equipes de que a pessoa só faz parte aparecem para consulta.
 */
import React, { useEffect, useState } from 'react';
import { t } from '../../src/i18n';
import { Icon } from './icons';
import { NameDialog } from './NameDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { addMember, createTeam, deleteTeam, isEmail, listTeams, removeMember, renameTeam } from './sharing';
import type { Team } from './sharing';
import { PREVIEW } from './demo';

export function TeamsView({ userId, userEmail, onError }: { userId: string; userEmail: string; onError: (text: string) => void }) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);

  const load = async () => {
    try {
      setTeams(await listTeams());
    } catch (e) {
      setTeams([]);
      onError(e instanceof Error ? e.message : t('Não foi possível carregar as equipes.'));
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!teams) {
    return (
      <div className="splash inline">
        <span className="spinner" />
      </div>
    );
  }
  const mine = teams.filter(tm => tm.owner_id === userId);
  const member = teams.filter(tm => tm.owner_id !== userId);

  return (
    <div className="teams">
      <div className="teams-head">
        <p className="muted">{t('Monte equipes para compartilhar pastas e arquivos com várias pessoas de uma vez. Quem entra na equipe já vê o que foi compartilhado com ela.')}</p>
        <button
          className="btn primary"
          onClick={() =>
            PREVIEW ? onError(t('Esta é uma demonstração: nada é salvo. Baixe o app KEYCON e crie sua conta para usar o Locker de verdade.')) : setCreating(true)
          }>
          <Icon name="plus" size={18} />
          {t('Nova equipe')}
        </button>
      </div>

      {!mine.length && !member.length ? (
        <div className="empty">
          <Icon name="team" size={44} />
          <p>{t('Você ainda não tem equipes.')}</p>
        </div>
      ) : null}

      <div className="team-grid">
        {mine.map(tm => (
          <TeamCard
            key={tm.id}
            team={tm}
            userEmail={userEmail}
            onRename={() => setRenaming(tm)}
            onDelete={() => setDeleting(tm)}
            onChanged={load}
            onError={onError}
          />
        ))}
      </div>

      {member.length ? (
        <>
          <h2 className="group-title">{t('Equipes de que você faz parte')}</h2>
          <div className="team-grid">
            {member.map(tm => (
              <section key={tm.id} className="team-card">
                <header className="team-card-head">
                  <span className="share-icon">
                    <Icon name="team" size={18} />
                  </span>
                  <h3>{tm.name || t('Equipe sem nome')}</h3>
                </header>
                <p className="muted">{tm.members.length === 1 ? t('1 pessoa') : t('{n} pessoas', { n: tm.members.length })}</p>
              </section>
            ))}
          </div>
        </>
      ) : null}

      {creating ? (
        <NameDialog
          title={t('Nova equipe')}
          initial={t('Equipe sem nome')}
          confirm={t('Criar')}
          onClose={() => setCreating(false)}
          onSubmit={async name => {
            await createTeam(name);
            await load();
          }}
        />
      ) : null}
      {renaming ? (
        <NameDialog
          title={t('Renomear equipe')}
          initial={renaming.name}
          confirm={t('OK')}
          onClose={() => setRenaming(null)}
          onSubmit={async name => {
            await renameTeam(renaming.id, name);
            await load();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title={t('Excluir a equipe?')}
          text={t('Quem é da equipe "{name}" deixa de ver o que foi compartilhado com ela. Seus arquivos continuam no Locker.', { name: deleting.name })}
          confirm={t('Excluir equipe')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteTeam(deleting.id);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function TeamCard({
  team,
  userEmail,
  onRename,
  onDelete,
  onChanged,
  onError,
}: {
  team: Team;
  userEmail: string;
  onRename: () => void;
  onDelete: () => void;
  onChanged: () => Promise<void>;
  onError: (text: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!isEmail(clean)) return onError(t('Digite um e-mail válido.'));
    if (clean === userEmail.toLowerCase()) return onError(t('Você já é o dono da equipe.'));
    setBusy(true);
    try {
      await addMember(team.id, clean);
      setEmail('');
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('Não foi possível adicionar.'));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (member: string) => {
    try {
      await removeMember(team.id, member);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('Não foi possível tirar da equipe.'));
    }
  };

  return (
    <section className="team-card">
      <header className="team-card-head">
        <span className="share-icon">
          <Icon name="team" size={18} />
        </span>
        <h3>{team.name || t('Equipe sem nome')}</h3>
        <button className="icon-btn small" aria-label={t('Renomear equipe')} title={t('Renomear')} onClick={onRename}>
          <Icon name="rename" size={16} />
        </button>
        <button className="icon-btn small" aria-label={t('Excluir equipe')} title={t('Excluir')} onClick={onDelete}>
          <Icon name="trash" size={16} />
        </button>
      </header>
      <ul className="team-members">
        {team.members.length ? (
          team.members.map(m => (
            <li key={m}>
              <span className="avatar small soft">{m[0].toUpperCase()}</span>
              <span className="name">{m}</span>
              <button className="icon-btn small" aria-label={t('Tirar {email} da equipe', { email: m })} onClick={() => remove(m)}>
                <Icon name="close" size={14} />
              </button>
            </li>
          ))
        ) : (
          <li className="muted">{t('Ninguém ainda.')}</li>
        )}
      </ul>
      <form className="share-add" onSubmit={add}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t('E-mail da pessoa')} aria-label={t('E-mail da pessoa')} inputMode="email" />
        <button className="btn" disabled={busy || !email.trim()}>
          {t('Adicionar')}
        </button>
      </form>
    </section>
  );
}
