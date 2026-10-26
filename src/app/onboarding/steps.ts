/**
 * "Primeiros passos" do Início: o que falta para o usuário tirar proveito do
 * app. Cada passo é marcado sozinho quando o app consegue ver que foi feito
 * (ex.: já existe uma pasta); os demais o usuário conclui pelo próprio passo.
 */
import type { IconName } from '../../keyboard/components/Icon';
import type { SegmentProfile } from '../../segments/segments';
import { t } from '../../i18n';
import { Repo } from '../../storage/storage';

/** Para onde o botão do passo leva. */
export type StepTarget = 'install' | 'account-data' | 'catalog' | 'shortcuts' | 'test';

export interface OnboardingStep {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  actionLabel: string;
  target: StepTarget;
  done: boolean;
}

/** Passos que só o usuário sabe se fez (não dá para detectar). */
export const MANUAL_STEPS = { keyboard: 'keyboard', test: 'test' } as const;

/**
 * `keyboardEnabled`: null quando o sistema não informa (iPhone, web) — aí o
 * passo é concluído pelo botão "Já ativei" na tela de instalação.
 */
export function buildSteps(segment: SegmentProfile, keyboardEnabled: boolean | null): OnboardingStep[] {
  const seller = Repo.getSeller();
  const folders = Repo.getFolders();
  const products = folders.flatMap(f => f.products);
  const shortcuts = Repo.getShortcuts();
  const manual = Repo.getStepsDone();
  const { item } = segment.terms;

  return [
    {
      id: 'keyboard',
      icon: 'teclado',
      title: t('Ativar o teclado'),
      description: t('Ligue o KEYCON nas configurações do celular.'),
      actionLabel: t('Ativar'),
      target: 'install',
      done: keyboardEnabled === true || manual.includes(MANUAL_STEPS.keyboard),
    },
    {
      id: 'profile',
      icon: 'clientes',
      title: t('Completar seu perfil'),
      description: t('Nome, negócio e WhatsApp entram nas suas mensagens.'),
      actionLabel: t('Completar'),
      target: 'account-data',
      done: !!seller.name.trim() && !!seller.phone.trim() && !!seller.business.trim(),
    },
    {
      id: 'folder',
      icon: 'novaPasta',
      title: t('Criar a primeira pasta'),
      description: t('As pastas organizam seus {items}.', { items: segment.terms.items }),
      actionLabel: t('Criar'),
      target: 'catalog',
      done: folders.length > 0,
    },
    {
      id: 'item',
      icon: 'arquivos',
      title: t('Cadastrar o primeiro {item}', { item }),
      description: t('Com preço e descrição, pronto para enviar.'),
      actionLabel: t('Cadastrar'),
      target: 'catalog',
      done: products.length > 0,
    },
    {
      id: 'photo',
      icon: 'foto',
      title: t('Adicionar uma foto'),
      description: t('O teclado envia a foto do {item} direto na conversa.', { item }),
      actionLabel: t('Adicionar'),
      target: 'catalog',
      done: products.some(p => p.photos.length > 0),
    },
    {
      id: 'shortcut',
      icon: 'atalhos',
      title: t('Criar um atalho'),
      description: t('Textos, áudios e links que você manda sempre, a um toque.'),
      actionLabel: t('Criar'),
      target: 'shortcuts',
      done: shortcuts.texts.length + shortcuts.audios.length + shortcuts.links.length > 0,
    },
    {
      id: 'test',
      icon: 'respostas',
      title: t('Testar o teclado'),
      description: t('Digite com o KEYCON e veja as sugestões de palavras.'),
      actionLabel: t('Testar'),
      target: 'test',
      done: manual.includes(MANUAL_STEPS.test),
    },
  ];
}
