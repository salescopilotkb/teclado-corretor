/**
 * Equipe da empresa (Plus: 1 equipe com até 5 pessoas; Pro: 5 equipes com até 50).
 *
 * A conta que assina cria o acesso de cada pessoa (nome, e-mail e senha). A pessoa
 * entra no app com esse e-mail, vê e baixa o Locker da empresa e tem teclado,
 * produtos, atalhos, CRM e agenda só dela. Só a empresa remove.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';
import { t } from '../../i18n';
import { makeStyles, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { ChoiceRow } from '../../keyboard/components/KeyboardForm';
import {
  addMember,
  CompanyError,
  createTeam,
  deleteTeam,
  listMembers,
  listTeams,
  removeMember,
  renameTeam,
  setMemberPassword,
  setMemberTeam,
} from '../../company/company';
import type { CompanyMember, CompanyTeam } from '../../company/company';
import { openPlans, refreshPlan } from '../../plans/plan';
import { usePlan } from '../../plans/usePlan';
import { Button, Card, CardText, CardTitle, EmptyState, MenuGroup, MenuRow, Page, SubHeader } from '../components/ui';

type Screen = { name: 'list' } | { name: 'add' } | { name: 'member'; id: string } | { name: 'team'; id: string | null };

const NO_TEAM = '__none__';

const failed = (e: unknown) =>
  Alert.alert(t('Atenção'), e instanceof CompanyError ? e.message : t('Não foi possível concluir. Verifique a internet e tente de novo.'));

export function CompanyScreen({ onBack }: { onBack: () => void }) {
  const plan = usePlan();
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [members, setMembers] = useState<CompanyMember[] | null>(null);
  const [teams, setTeams] = useState<CompanyTeam[]>([]);

  const load = useCallback(() => {
    Promise.all([listMembers(), listTeams()])
      .then(([m, tm]) => {
        setMembers(m);
        setTeams(tm);
      })
      .catch(e => {
        setMembers([]);
        failed(e);
      });
    refreshPlan().catch(() => {});
  }, []);
  useEffect(load, [load]);

  const maxPeople = plan.limits.maxDependents;
  const maxTeams = plan.limits.maxTeams;
  const teamName = (id: string | null) => teams.find(tm => tm.id === id)?.name ?? t('Sem equipe');
  const back = () => {
    setScreen({ name: 'list' });
    load();
  };

  if (screen.name === 'add') return <MemberForm teams={teams} onBack={() => setScreen({ name: 'list' })} onSaved={back} />;
  if (screen.name === 'team') {
    return <TeamForm team={teams.find(tm => tm.id === screen.id) ?? null} onBack={() => setScreen({ name: 'list' })} onSaved={back} />;
  }
  if (screen.name === 'member') {
    const member = members?.find(m => m.id === screen.id);
    if (member) return <MemberDetail member={member} teams={teams} onBack={() => setScreen({ name: 'list' })} onSaved={back} />;
  }

  const people = members ?? [];
  const full = maxPeople !== null && people.length >= maxPeople;
  const teamsFull = maxTeams !== null && teams.length >= maxTeams;

  return (
    <Page>
      <SubHeader title={t('Equipe da empresa')} onBack={onBack} />

      <Card>
        <CardTitle>
          {maxPeople === null
            ? t('{n} pessoas na equipe', { n: people.length })
            : t('{n} de {max} pessoas · {teams} de {maxTeams} equipes', {
                n: people.length,
                max: maxPeople,
                teams: teams.length,
                maxTeams: maxTeams ?? '∞',
              })}
        </CardTitle>
        <CardText>
          {t(
            'Cada pessoa entra no app com o próprio e-mail e senha, vê e baixa o Locker da empresa e tem teclado, produtos, atalhos, clientes e agenda só dela. Só você remove.',
          )}
        </CardText>
      </Card>

      {members === null ? (
        <ActivityIndicator />
      ) : (
        <>
          <Button
            testID="company-add"
            label={t('Adicionar pessoa')}
            icon="adicionar"
            disabled={full}
            onPress={() => setScreen({ name: 'add' })}
          />
          {full ? <Button label={t('Mais pessoas: ver planos')} variant="secondary" onPress={openPlans} /> : null}

          {people.length ? (
            <MenuGroup>
              {people.map(m => (
                <MenuRow
                  key={m.id}
                  testID={`company-member-${m.id}`}
                  icon="clientes"
                  title={m.name}
                  subtitle={m.email}
                  value={teamName(m.teamId)}
                  onPress={() => setScreen({ name: 'member', id: m.id })}
                />
              ))}
            </MenuGroup>
          ) : (
            <EmptyState icon="clientes" title={t('Ninguém na equipe ainda')} text={t('Adicione as pessoas que vendem com você.')} />
          )}

          <CardTitle>{t('Equipes')}</CardTitle>
          {teams.length ? (
            <MenuGroup>
              {teams.map(tm => (
                <MenuRow
                  key={tm.id}
                  icon="etiquetas"
                  title={tm.name}
                  value={String(people.filter(m => m.teamId === tm.id).length)}
                  onPress={() => setScreen({ name: 'team', id: tm.id })}
                />
              ))}
            </MenuGroup>
          ) : null}
          <Button
            label={t('Nova equipe')}
            variant="secondary"
            icon="adicionar"
            disabled={teamsFull}
            onPress={() => setScreen({ name: 'team', id: null })}
          />
        </>
      )}
    </Page>
  );
}

function Field({
  label,
  value,
  onChange,
  secure,
  email,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  email?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize={email || secure ? 'none' : 'words'}
        autoCorrect={false}
        keyboardType={email ? 'email-address' : 'default'}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function TeamPicker({ teams, value, onChange }: { teams: CompanyTeam[]; value: string | null; onChange: (id: string | null) => void }) {
  const styles = useStyles();
  if (!teams.length) return null;
  return (
    <View>
      <Text style={styles.label}>{t('Equipe')}</Text>
      <ChoiceRow
        onCard
        options={[{ value: NO_TEAM, label: t('Sem equipe') }, ...teams.map(tm => ({ value: tm.id, label: tm.name }))]}
        value={value ?? NO_TEAM}
        onChange={v => onChange(v === NO_TEAM ? null : v)}
      />
    </View>
  );
}

function MemberForm({ teams, onBack, onSaved }: { teams: CompanyTeam[]; onBack: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamId, setTeamId] = useState<string | null>(teams[0]?.id ?? null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await addMember({ name, email, password, teamId });
      Alert.alert(
        t('Pessoa adicionada'),
        t('Passe para {name} o e-mail e a senha. Ela entra pelo app KEYCON e pode trocar a senha em "Esqueci a senha".', {
          name: name.trim(),
        }),
      );
      onSaved();
    } catch (e) {
      failed(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <SubHeader title={t('Adicionar pessoa')} onBack={onBack} />
      <Card>
        <Field testID="company-name" label={t('Nome')} value={name} onChange={setName} />
        <Field testID="company-email" label={t('E-mail')} value={email} onChange={setEmail} email />
        <Field testID="company-password" label={t('Senha inicial')} value={password} onChange={setPassword} secure />
        <TeamPicker teams={teams} value={teamId} onChange={setTeamId} />
        <CardText>{t('A pessoa usa este e-mail e esta senha para entrar no app. O e-mail não pode ter outra conta KEYCON.')}</CardText>
      </Card>
      <Button
        testID="company-save"
        label={t('Adicionar')}
        loading={saving}
        disabled={!name.trim() || !email.trim() || password.length < 6}
        onPress={save}
      />
    </Page>
  );
}

function MemberDetail({
  member,
  teams,
  onBack,
  onSaved,
}: {
  member: CompanyMember;
  teams: CompanyTeam[];
  onBack: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await job();
      if (done) Alert.alert(t('Pronto'), done);
      onSaved();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert(
      t('Remover {name}', { name: member.name }),
      t('{name} deixa de entrar no app e perde o acesso ao Locker da empresa. O que estava só no celular dela fica lá.', {
        name: member.name,
      }),
      [
        { text: t('Cancelar'), style: 'cancel' },
        { text: t('Remover'), style: 'destructive', onPress: () => run(() => removeMember(member.id)) },
      ],
    );

  return (
    <Page>
      <SubHeader title={member.name} subtitle={member.email} onBack={onBack} />
      {teams.length ? (
        <Card>
          <TeamPicker teams={teams} value={member.teamId} onChange={id => run(() => setMemberTeam(member.id, id))} />
        </Card>
      ) : null}
      <Card>
        <Field label={t('Nova senha')} value={password} onChange={setPassword} secure />
        <Button
          label={t('Trocar a senha')}
          variant="secondary"
          loading={busy}
          disabled={password.length < 6}
          onPress={() => run(() => setMemberPassword(member.id, password), t('Senha trocada. Passe a senha nova para a pessoa.'))}
        />
      </Card>
      <Button label={t('Remover da equipe')} variant="danger" icon="lixeira" disabled={busy} onPress={remove} />
    </Page>
  );
}

function TeamForm({ team, onBack, onSaved }: { team: CompanyTeam | null; onBack: () => void; onSaved: () => void }) {
  const [name, setName] = useState(team?.name ?? '');
  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
      onSaved();
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <SubHeader title={team ? t('Editar equipe') : t('Nova equipe')} onBack={onBack} />
      <Card>
        <Field label={t('Nome da equipe')} value={name} onChange={setName} />
      </Card>
      <Button
        label={t('Salvar')}
        loading={busy}
        disabled={!name.trim()}
        onPress={() => run(() => (team ? renameTeam(team.id, name) : createTeam(name)))}
      />
      {team ? (
        <Button
          label={t('Excluir equipe')}
          variant="danger"
          icon="lixeira"
          disabled={busy}
          onPress={() =>
            Alert.alert(t('Excluir equipe'), t('As pessoas continuam na empresa, só ficam sem equipe.'), [
              { text: t('Cancelar'), style: 'cancel' },
              { text: t('Excluir'), style: 'destructive', onPress: () => run(() => deleteTeam(team.id)) },
            ])
          }
        />
      ) : null}
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  field: { gap: 6, marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: touchTarget,
    fontSize: 15,
  },
}));
