import { getLanguage, LANGUAGES, t } from '../../i18n';
import type { Lang } from '../../i18n';
import { COUNTRIES, CURRENCIES, deduceFromMarketId, resolveMarketId, TARGET_AUDIENCES } from '../../i18n/markets';
import type { MarketId } from '../../i18n/markets';
import { applyProfileLanguages } from '../../i18n/profile';
import { AudiencePicker, CountryPicker, CurrencyPicker, LanguagePicker, marketSummary } from '../components/LanguagePickers';
/**
 * Conta — perfil e configurações, cada assunto no seu submenu.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import { Repo } from '../../storage/storage';
import type { CountryId, CurrencyId, SegmentId, SellerProfile, TargetAudienceId, ThemePreference } from '../../types';
import { getSegment } from '../../segments/segments';
import { makeStyles, onCoralText, radius, spacing, touchTarget, typography, useColors } from '../../keyboard/theme';
import { Icon } from '../../keyboard/components/Icon';
import { AI_CONFIG } from '../../services/aiService';
import { AuthError, currentEmail, pushProfile, signInWithGoogle } from '../../services/auth';
import { SegmentPicker } from '../components/SegmentPicker';
import { BUILD_INFO } from '../../config/buildInfo';
import { fillLegal, LEGAL_UPDATED, PRIVACY, TERMS } from '../../legal/legal';
import type { LegalDocument } from '../../legal/legal';
import { KeyconLogo } from '../../keyboard/components/KeyconLogo';
import { Button, Card, CardText, CardTitle, MenuGroup, MenuRow, Page, ScreenTitle, StatusChip, SubHeader } from '../components/ui';

export type AccountSection =
  | 'root'
  | 'data'
  | 'segment'
  | 'market'
  | 'language'
  | 'theme'
  | 'status'
  | 'about'
  | 'terms'
  | 'privacy'
  | 'licenses';

interface Props {
  onLogout: () => void;
  onThemeChange?: (theme: ThemePreference) => void;
  onProfileChange?: (seller: SellerProfile) => void;
  /** Abre direto num submenu (ex.: "Completar seu perfil" no Início). */
  initialSection?: AccountSection;
}

const THEME_OPTIONS: Array<{ key: ThemePreference; label: string; desc: string }> = [
  { key: 'light', label: 'Claro', desc: 'Fundo claro e suave' },
  { key: 'dark', label: 'Escuro', desc: 'Confortável para uso contínuo' },
  { key: 'system', label: 'Padrão do sistema', desc: 'Segue o celular' },
];

export function ProfileSettingsScreen({ onLogout, onThemeChange, onProfileChange, initialSection = 'root' }: Props) {
  const [section, setSection] = useState<AccountSection>(initialSection);
  const [seller, setSeller] = useState<SellerProfile>(() => Repo.getSeller());
  const [theme, setTheme] = useState<ThemePreference>(() => Repo.getTheme());
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    currentEmail().then(setEmail).catch(() => {});
  }, []);

  const back = () => setSection('root');

  /** Grava no aparelho (teclado) e na conta do Supabase. */
  const saveProfile = async (updated: SellerProfile, successMessage: string) => {
    setSeller(updated);
    onProfileChange?.(updated);
    try {
      await pushProfile(updated);
      Alert.alert(t('Salvo'), successMessage);
    } catch (e) {
      Alert.alert(
        t('Salvo só neste aparelho'),
        t('O teclado já usa os novos dados, mas não foi possível salvar na nuvem: {v}', { v: e instanceof AuthError ? e.message : String(e) }),
      );
    }
    setSection('root');
  };

  if (section === 'data') {
    return (
      <DataSection
        seller={seller}
        onBack={back}
        onSave={s => saveProfile(s, 'Seus dados foram salvos na conta e no teclado.')}
      />
    );
  }

  if (section === 'segment') {
    return (
      <SegmentSection
        current={seller.segment}
        onBack={back}
        onSave={segment =>
          saveProfile(
            { ...seller, segment },
            `Agora o app está no ramo ${getSegment(segment).label}. O que você cadastrou continua igual.`,
          )
        }
      />
    );
  }

  if (section === 'language') {
    return (
      <LanguageSection
        current={seller.language ?? 'pt'}
        onBack={back}
        onSave={language => {
          const updated = { ...seller, language };
          applyProfileLanguages(updated);
          saveProfile(updated, t('Idioma alterado com sucesso.'));
        }}
      />
    );
  }

  if (section === 'market') {
    return (
      <MarketSection
        seller={seller}
        onBack={back}
        onSave={settings => {
          const updated: SellerProfile = {
            ...seller,
            market: settings.market,
            country: settings.country,
            currency: settings.currency,
            targetAudience: settings.targetAudience,
          };
          applyProfileLanguages(updated);
          saveProfile(updated, t('Configurações de venda atualizadas com sucesso.'));
        }}
      />
    );
  }

  if (section === 'theme') {
    return (
      <ThemeSection
        theme={theme}
        onBack={back}
        onSelect={t => {
          setTheme(t);
          Repo.setTheme(t);
          onThemeChange?.(t);
        }}
      />
    );
  }

  if (section === 'status') return <StatusSection email={email} onBack={back} />;
  if (section === 'about') return <AboutSection onBack={back} onOpen={setSection} />;
  if (section === 'terms') return <LegalScreen doc={TERMS} onBack={() => setSection('about')} />;
  if (section === 'privacy') return <LegalScreen doc={PRIVACY} onBack={() => setSection('about')} />;
  if (section === 'licenses') return <LicensesSection onBack={() => setSection('about')} />;

  return (
    <Page>
      <ScreenTitle title={t('Conta')} />

      <ProfileCard seller={seller} email={email} />

      <MenuGroup>
        <MenuRow testID="account-data" icon="clientes" title={t('Seus dados')} subtitle={t('Nome, negócio e WhatsApp')} onPress={() => setSection('data')} />
        <MenuRow
          testID="account-segment"
          icon={getSegment(seller.segment).icon}
          title={t('Ramo do negócio')}
          value={getSegment(seller.segment).label}
          onPress={() => setSection('segment')}
        />
        <MenuRow
          icon="globo"
          title={t('Idioma do app')}
          value={LANGUAGES.find(l => l.id === (seller.language ?? 'pt'))?.label}
          onPress={() => setSection('language')}
        />
        <MenuRow
          icon="etiquetas"
          title={t('Onde você vende?')}
          value={marketSummary(seller)}
          onPress={() => setSection('market')}
        />
        <MenuRow
          icon="configuracoes"
          title={t('Aparência')}
          value={t(THEME_OPTIONS.find(o => o.key === theme)?.label ?? '')}
          onPress={() => setSection('theme')}
        />
      </MenuGroup>

      <MenuGroup>
        <MenuRow icon="dados" title={t('Status da conta')} subtitle={t('Conexão e sincronização')} onPress={() => setSection('status')} />
        <MenuRow icon="info" title={t('Sobre o KEYCON')} subtitle={t('Versão, termos e privacidade')} value={BUILD_INFO.version} onPress={() => setSection('about')} />
      </MenuGroup>

      <Button label={t('Sair da conta')} variant="danger" icon="sair" onPress={onLogout} />
    </Page>
  );
}

function ProfileCard({ seller, email }: { seller: SellerProfile; email: string | null }) {
  const styles = useStyles();
  const initials =
    seller.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p, i, all) => (i === 0 || i === all.length - 1 ? p[0] : ''))
      .join('')
      .toUpperCase() || 'K';
  return (
    <Card style={styles.profileCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.profileName} numberOfLines={1}>
          {seller.name || t('Seu nome')}
        </Text>
        <Text style={styles.profileSub} numberOfLines={1}>
          {email ?? ' '}
        </Text>
      </View>
    </Card>
  );
}

function DataSection({ seller, onBack, onSave }: { seller: SellerProfile; onBack: () => void; onSave: (s: SellerProfile) => void }) {
  const colors = useColors();
  const styles = useStyles();
  const [name, setName] = useState(seller.name);
  const [business, setBusiness] = useState(seller.business);
  const [phone, setPhone] = useState(seller.phone);

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('Atenção'), t('Preencha seu nome.'));
      return;
    }
    onSave({ ...seller, name: name.trim(), business: business.trim(), phone: phone.trim() });
  };

  const field = (label: string, value: string, onChange: (v: string) => void, placeholder: string, phonePad = false) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={phonePad ? 'phone-pad' : 'default'}
      />
    </View>
  );

  return (
    <Page>
      <SubHeader title={t('Seus dados')} onBack={onBack} />
      <Card>
        <CardText>{t('Usados nas mensagens prontas: {{nome}}, {{empresa}} e {{telefone}}.')}</CardText>
        {field(t('Nome completo'), name, setName, t('Seu nome'))}
        {field(t('Nome do negócio'), business, setBusiness, t('Nome da sua empresa ou loja'))}
        {field(t('WhatsApp'), phone, setPhone, t('Seu número com DDD'), true)}
      </Card>
      <Button testID="data-save" label={t('Salvar')} onPress={save} />
    </Page>
  );
}

function SegmentSection({ current, onBack, onSave }: { current: SegmentId; onBack: () => void; onSave: (s: SegmentId) => void }) {
  const [segment, setSegment] = useState<SegmentId>(current);
  return (
    <Page>
      <SubHeader title={t('Ramo do negócio')} onBack={onBack} />
      <Card>
        <CardText>{t('Muda os nomes, os campos dos itens, o funil de clientes e a IA. Nada do que você cadastrou é apagado.')}</CardText>
        <SegmentPicker value={segment} onChange={setSegment} />
      </Card>
      <Button label={t('Salvar')} disabled={segment === current} onPress={() => onSave(segment)} />
    </Page>
  );
}

function ThemeSection({ theme, onBack, onSelect }: { theme: ThemePreference; onBack: () => void; onSelect: (t: ThemePreference) => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <Page>
      <SubHeader title={t('Aparência')} onBack={onBack} />
      <Card>
        <CardText>{t('Vale para o app e para o teclado.')}</CardText>
        {THEME_OPTIONS.map(opt => {
          const selected = theme === opt.key;
          return (
            <Pressable
              key={opt.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.option, selected && styles.optionActive]}
              onPress={() => onSelect(opt.key)}>
              <View style={styles.flex}>
                <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>{t(opt.label)}</Text>
                <Text style={styles.optionDesc}>{t(opt.desc)}</Text>
              </View>
              {selected && <Icon name="check" size={20} color={colors.primaryText} />}
            </Pressable>
          );
        })}
      </Card>
    </Page>
  );
}

function StatusSection({ email, onBack }: { email: string | null; onBack: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const hasGoogle = Repo.hasGoogleMeetAccess();

  const handleConnectGoogle = async () => {
    setConnecting(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert(t('Não foi possível conectar o Google'), String(e));
    } finally {
      setConnecting(false);
    }
  };

  const rows: Array<{ done: boolean; title: string; text: string }> = [
    { done: !!email, title: t('Conta'), text: email ? t('Conectada: {email}', { email }) : t('Verificando conexão...') },
    {
      done: hasGoogle,
      title: t('Reuniões no Google Meet'),
      text: hasGoogle
        ? t('Liberado: links e salas do Google Meet gerados automaticamente.')
        : t('Pendente: conecte sua conta Google para liberar links de reunião automáticos.'),
    },
    { done: true, title: t('Teclado'), text: t('Login e dados compartilhados com o teclado neste aparelho.') },
    { done: false, title: t('Itens e atalhos'), text: t('Salvos neste aparelho. Sincronização com a nuvem em breve.') },
    { done: false, title: t('Fotos e vídeos'), text: t('Enviados como links externos por enquanto.') },
    {
      done: !AI_CONFIG.useMock,
      title: t('IA'),
      text: AI_CONFIG.useMock ? t('Modo demonstração (servidor não configurado).') : t('Conectada ao servidor.'),
    },
  ];
  return (
    <Page>
      <SubHeader title={t('Status da conta')} onBack={onBack} />
      {rows.map(r => (
        <Card key={r.title}>
          <CardTitle>{r.title}</CardTitle>
          <StatusChip done={r.done} label={r.done ? t('Pronto') : t('Pendente')} />
          <CardText>{r.text}</CardText>
        </Card>
      ))}
      {!hasGoogle && (
        <Button
          label={t('Liberar com conta Google')}
          variant="secondary"
          icon="respostas"
          disabled={connecting}
          onPress={handleConnectGoogle}
        />
      )}
    </Page>
  );
}

/** "26/10/2026" (ou "10/26/2026" em inglês) a partir de uma data ISO. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return getLanguage() === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

/** Sobre: o app, a versão (muda a cada commit, ver scripts/write_build_info.js) e os documentos. */
function AboutSection({ onBack, onOpen }: { onBack: () => void; onOpen: (s: AccountSection) => void }) {
  const styles = useStyles();
  return (
    <Page>
      <SubHeader title={t('Sobre o KEYCON')} onBack={onBack} />
      <Card style={styles.aboutCard}>
        <KeyconLogo size={30} />
        <CardText>{t('Teclado inteligente. Vendas organizadas.')}</CardText>
        <CardText>
          {t('App e teclado para vender pelo WhatsApp e outros apps de mensagem: catálogo, arquivos, atalhos, clientes e agenda sempre à mão, com corretor em português, inglês e espanhol.')}
        </CardText>
      </Card>
      <Card>
        <CardTitle>{t('Versão')}</CardTitle>
        <Text testID="about-version" style={styles.version}>
          {BUILD_INFO.version}
        </Text>
        <CardText>{t('Compilação {commit} · {date}', { commit: BUILD_INFO.commit, date: formatDate(BUILD_INFO.date) })}</CardText>
      </Card>
      <MenuGroup>
        <MenuRow testID="about-terms" icon="notas" title={t('Termos de Uso')} onPress={() => onOpen('terms')} />
        <MenuRow testID="about-privacy" icon="escudo" title={t('Política de Privacidade')} onPress={() => onOpen('privacy')} />
        <MenuRow testID="about-licenses" icon="info" title={t('Licenças de terceiros')} subtitle={t('Créditos do dicionário e da fonte')} onPress={() => onOpen('licenses')} />
      </MenuGroup>
      <CardText>{t('© {year} {company}. Todos os direitos reservados.', { year: BUILD_INFO.date.slice(0, 4), company: fillLegal('{company}') })}</CardText>
    </Page>
  );
}

/** Termos de Uso / Política de Privacidade, no idioma do app. */
function LegalScreen({ doc, onBack }: { doc: Record<Lang, LegalDocument>; onBack: () => void }) {
  const styles = useStyles();
  const current = doc[getLanguage()] ?? doc.pt;
  return (
    <Page>
      <SubHeader title={current.title} onBack={onBack} />
      <CardText>{t('Última atualização: {date}', { date: formatDate(LEGAL_UPDATED) })}</CardText>
      {current.sections.map(section => (
        <Card key={section.title}>
          <CardTitle>{section.title}</CardTitle>
          {section.paragraphs.map((para, i) => (
            <Text key={i} style={styles.legalText}>
              {fillLegal(para)}
            </Text>
          ))}
        </Card>
      ))}
    </Page>
  );
}

/**
 * Créditos que as licenças dos dados do corretor e da fonte exigem
 * (CC BY-SA 4.0 e CC BY 2.0 FR pedem atribuição; a OFL acompanha a fonte).
 */
function LicensesSection({ onBack }: { onBack: () => void }) {
  const open = (url: string) => () => Linking.openURL(url).catch(() => {});
  return (
    <Page>
      <SubHeader title={t('Licenças de terceiros')} onBack={onBack} />
      <Card>
        <CardTitle>{t('Dicionário do teclado')}</CardTitle>
        <CardText>
          {t('Listas de palavras do português, inglês e espanhol baseadas em FrequencyWords, de Hermit Dave (legendas do OpenSubtitles), licença Creative Commons BY-SA 4.0.')}
        </CardText>
        <Button label={t('Ver licença')} variant="secondary" onPress={open('https://creativecommons.org/licenses/by-sa/4.0/')} />
      </Card>
      <Card>
        <CardTitle>{t('Frases do corretor')}</CardTitle>
        <CardText>
          {t('Palavras que costumam vir em sequência, tiradas das frases em português, inglês e espanhol do Tatoeba (tatoeba.org), licença Creative Commons BY 2.0 FR.')}
        </CardText>
        <Button label={t('Ver licença')} variant="secondary" onPress={open('https://creativecommons.org/licenses/by/2.0/fr/')} />
      </Card>
      <Card>
        <CardTitle>{t('Fonte')}</CardTitle>
        <CardText>{t('Inter, de Rasmus Andersson, licença SIL Open Font License 1.1.')}</CardText>
      </Card>
    </Page>
  );
}

function LanguageSection({ current, onBack, onSave }: { current: Lang; onBack: () => void; onSave: (lang: Lang) => void }) {
  const [selected, setSelected] = useState<Lang>(current);
  return (
    <Page>
      <SubHeader title={t('Idioma do app')} onBack={onBack} />
      <Card>
        <CardTitle>{t('Escolha o idioma')}</CardTitle>
        <CardText>{t('Define o idioma de todas as telas do aplicativo e dos botões do teclado.')}</CardText>
        <LanguagePicker value={selected} onChange={setSelected} />
      </Card>
      <Button label={t('Salvar')} onPress={() => onSave(selected)} />
    </Page>
  );
}

function MarketSection({
  seller,
  onBack,
  onSave,
}: {
  seller: SellerProfile;
  onBack: () => void;
  onSave: (settings: {
    market: MarketId;
    country: CountryId;
    currency: CurrencyId;
    targetAudience: TargetAudienceId;
  }) => void;
}) {
  const styles = useStyles();
  const deduced = deduceFromMarketId(seller.market);
  const [country, setCountry] = useState<CountryId>(seller.country ?? deduced.country);
  const [currency, setCurrency] = useState<CurrencyId>(seller.currency ?? deduced.currency);
  const [audience, setAudience] = useState<TargetAudienceId>(seller.targetAudience ?? deduced.targetAudience);

  const selectedCountry = COUNTRIES.find(c => c.id === country) ?? COUNTRIES[0];
  const selectedCurrency = CURRENCIES.find(c => c.id === currency) ?? CURRENCIES[0];
  const selectedAudience = TARGET_AUDIENCES.find(a => a.id === audience) ?? TARGET_AUDIENCES[0];

  function handleCountryChange(newCountry: CountryId) {
    setCountry(newCountry);
    const countryObj = COUNTRIES.find(c => c.id === newCountry);
    if (countryObj) {
      setCurrency(countryObj.defaultCurrency);
      setAudience(countryObj.defaultAudience);
    }
  }

  function handleSave() {
    const market = resolveMarketId(country, currency, audience);
    onSave({
      market,
      country,
      currency,
      targetAudience: audience,
    });
  }

  const samplePrice =
    selectedCurrency.symbolPosition === 'before'
      ? `${selectedCurrency.symbol}${selectedCurrency.symbolSpace ? ' ' : ''}150${selectedCurrency.decimals > 0 ? selectedCurrency.decimal + '00' : ''}`
      : `150${selectedCurrency.decimals > 0 ? selectedCurrency.decimal + '00' : ''}${selectedCurrency.symbolSpace ? ' ' : ''}${selectedCurrency.symbol}`;

  return (
    <Page>
      <SubHeader title={t('Onde você vende?')} onBack={onBack} />

      <Card>
        <CardTitle>{t('1. País onde você opera')}</CardTitle>
        <CardText>{t('Define o código telefônico para links do WhatsApp e formatos regionais.')}</CardText>
        <CountryPicker value={country} onChange={handleCountryChange} />
      </Card>

      <Card>
        <CardTitle>{t('2. Moeda das suas vendas')}</CardTitle>
        <CardText>{t('Define o símbolo monetário dos seus produtos no catálogo e orçamentos.')}</CardText>
        <CurrencyPicker value={currency} onChange={setCurrency} />
      </Card>

      <Card>
        <CardTitle>{t('3. Para quem você vende?')}</CardTitle>
        <CardText>{t('O público define o idioma das mensagens automáticas para os clientes e o corretor do teclado.')}</CardText>
        <AudiencePicker value={audience} onChange={setAudience} />
      </Card>

      <View style={styles.modelingCard}>
        <View style={styles.modelingHead}>
          <Icon name="ia" size={20} color={styles.modelingAiIcon.color} />
          <Text style={styles.modelingTitle}>{t('Como o KEYCON se modela para você')}</Text>
        </View>

        <View style={styles.modelingGrid}>
          <View style={styles.modelingRow}>
            <Text style={styles.modelingLabel}>{t('Mensagens para clientes')}</Text>
            <Text style={styles.modelingValue}>
              {selectedAudience.languageLabel} ({selectedAudience.label})
            </Text>
          </View>
          <View style={styles.modelingRow}>
            <Text style={styles.modelingLabel}>{t('Teclado e corretor')}</Text>
            <Text style={styles.modelingValue}>{selectedAudience.languageLabel}</Text>
          </View>
          <View style={styles.modelingRow}>
            <Text style={styles.modelingLabel}>{t('Exemplo de preço')}</Text>
            <Text style={styles.modelingValue}>
              {samplePrice} ({selectedCurrency.id})
            </Text>
          </View>
          <View style={styles.modelingRow}>
            <Text style={styles.modelingLabel}>{t('WhatsApp internacional')}</Text>
            <Text style={styles.modelingValue}>
              +{selectedCountry.phoneCode} ({selectedCountry.name})
            </Text>
          </View>
        </View>
      </View>

      <Button testID="save-market-btn" label={t('Salvar')} onPress={handleSave} />
    </Page>
  );
}

const useStyles = makeStyles(colors => ({
  aboutCard: { gap: spacing.sm },
  version: { fontSize: 22, fontWeight: '700', color: colors.text },
  legalText: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  flex: { flex: 1 },
  profileCard: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimary, fontSize: 18, fontWeight: '700', ...onCoralText },
  profileName: { ...typography.title, color: colors.text },
  profileSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  field: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget + 4,
    fontSize: 15,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  optionActive: { backgroundColor: colors.primarySoft },
  optionLabel: { fontSize: 15, fontWeight: '500', color: colors.textSecondary },
  optionLabelActive: { color: colors.text, fontWeight: '600' },
  optionDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  modelingCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.violetBg,
  },
  modelingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modelingAiIcon: {
    color: colors.violet,
  },
  modelingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  modelingGrid: {
    gap: spacing.sm,
  },
  modelingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  modelingLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  modelingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
}));
