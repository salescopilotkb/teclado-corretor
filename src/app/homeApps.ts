/**
 * Os "apps" do Início (a tela que imita a tela inicial de um celular) e a barra
 * de baixo (dock), que a pessoa personaliza. Quem está na barra sai da grade,
 * como num celular.
 */
import { t } from '../i18n';
import type { IconName } from '../keyboard/components/Icon';
import type { Palette } from '../keyboard/theme';
import { getSegment } from '../segments/segments';
import { Repo } from '../storage/storage';

export type HomeAppId =
  | 'products'
  | 'shortcuts'
  | 'clients'
  | 'agenda'
  | 'files'
  | 'keyboard'
  | 'steps'
  | 'tutorial'
  | 'plans'
  | 'profile';

export interface HomeApp {
  id: HomeAppId;
  label: string;
  icon: IconName;
  /** Cor do ícone (o fundo do quadrado é a mesma cor, bem clara). */
  tint: (colors: Palette) => string;
}

/** Ordem da grade. */
const ORDER: HomeAppId[] = [
  'products',
  'shortcuts',
  'clients',
  'agenda',
  'files',
  'keyboard',
  'steps',
  'plans',
  'tutorial',
  'profile',
];

/** Máximo de ícones escolhidos na barra (o Início fica sempre na frente). */
export const DOCK_MAX = 4;
export const DEFAULT_DOCK: HomeAppId[] = ['clients', 'agenda', 'files', 'profile'];
/** "Primeiros passos" some quando tudo está feito: não entra na barra. */
const NOT_IN_DOCK: HomeAppId[] = ['steps'];

export function homeApp(id: HomeAppId): HomeApp {
  switch (id) {
    case 'products':
      // O nome e o ícone do catálogo seguem o ramo ("Imóveis", "Cardápio"...)
      return { id, label: getSegment(Repo.getSegment()).terms.catalog, icon: getSegment(Repo.getSegment()).icon, tint: c => c.primary };
    case 'shortcuts':
      return { id, label: t('Atalhos'), icon: 'atalhos', tint: () => '#E8A317' };
    case 'clients':
      return { id, label: t('Clientes'), icon: 'clientes', tint: c => c.blue };
    case 'agenda':
      return { id, label: t('Agenda'), icon: 'calendario', tint: c => c.violet };
    case 'files':
      return { id, label: 'Locker', icon: 'galeria', tint: c => c.teal };
    case 'keyboard':
      return { id, label: t('Teclado'), icon: 'teclado', tint: c => c.iconNeutral };
    case 'steps':
      return { id, label: t('Primeiros passos'), icon: 'check', tint: c => c.success };
    case 'plans':
      return { id, label: t('Planos'), icon: 'favoritos', tint: c => c.primaryStrong };
    case 'tutorial':
      return { id, label: t('Tutorial'), icon: 'info', tint: c => c.info };
    case 'profile':
      return { id, label: t('Conta'), icon: 'configuracoes', tint: c => c.iconMuted };
  }
}

/** Todos os apps, na ordem da grade (sem os que não valem para esta conta). */
export function homeApps(hidden: HomeAppId[] = []): HomeApp[] {
  return ORDER.filter(id => !hidden.includes(id)).map(homeApp);
}

/** Apps que podem ir para a barra. */
export function dockChoices(hidden: HomeAppId[] = []): HomeApp[] {
  return homeApps([...hidden, ...NOT_IN_DOCK]);
}

/** A barra escolhida (ou a padrão), só com ids válidos e sem repetir. */
export function getDock(): HomeAppId[] {
  const saved = Repo.getDock();
  if (!saved) return DEFAULT_DOCK;
  const valid = saved.filter(
    (id, i): id is HomeAppId => ORDER.includes(id as HomeAppId) && !NOT_IN_DOCK.includes(id as HomeAppId) && saved.indexOf(id) === i,
  );
  return valid.slice(0, DOCK_MAX);
}

export function setDock(ids: HomeAppId[]): void {
  const same = ids.length === DEFAULT_DOCK.length && ids.every((id, i) => id === DEFAULT_DOCK[i]);
  // Igual à padrão: não guarda (se a padrão mudar numa versão nova, acompanha)
  Repo.setDock(same ? null : ids.slice(0, DOCK_MAX));
}

/** Cor com transparência (para o fundo dos quadrados). Aceita #RGB, #RRGGBB e rgb(a). */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, ch => ch + ch) : hex[1];
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map(x => x.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
