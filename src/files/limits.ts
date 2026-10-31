/**
 * Limites do Locker: tamanho por tipo de arquivo e espaço de cada plano.
 *
 * O mesmo vale no servidor (supabase/functions/locker) e no teto do código
 * nativo do teclado (MediaFiles.kt e MediaPickActivity.kt: 64 MB, o maior).
 */
import { t } from '../i18n';

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Imagem, vídeo ou qualquer outro arquivo (PDF, documento, áudio...). */
export type LockerKind = 'image' | 'video' | 'other';

export const LOCKER_FILE_LIMITS: Record<LockerKind, number> = {
  image: 16 * MB,
  video: 64 * MB,
  other: 10 * MB,
};

/** Teto para escolher um arquivo no aparelho (o maior dos limites: vídeo). */
export const MAX_PICK_BYTES = LOCKER_FILE_LIMITS.video;

export const lockerKindOf = (mime: string | undefined): LockerKind =>
  mime?.startsWith('image/') ? 'image' : mime?.startsWith('video/') ? 'video' : 'other';

/** Mensagem pronta quando o arquivo passa do limite do tipo dele (null = cabe). */
export function lockerSizeError(mime: string | undefined, size: number | undefined): string | null {
  const kind = lockerKindOf(mime);
  const limit = LOCKER_FILE_LIMITS[kind];
  if (!size || size <= limit) return null;
  const mb = Math.round(limit / MB);
  if (kind === 'image') return t('A foto passa de {mb} MB. Escolha uma menor.', { mb });
  if (kind === 'video') return t('O vídeo passa de {mb} MB. Grave um mais curto ou mande o link.', { mb });
  return t('O arquivo passa de {mb} MB. Escolha um menor.', { mb });
}

export type LockerPlanId = 'basic' | 'plus' | 'pro' | 'enterprise';

/** Planos de assinatura do Locker. Enterprise: espaço combinado com o suporte. */
export const LOCKER_PLANS: Record<LockerPlanId, { name: string; bytes: number | null }> = {
  basic: { name: 'Basic', bytes: 5 * GB },
  plus: { name: 'Plus', bytes: 20 * GB },
  pro: { name: 'Pro', bytes: 100 * GB },
  enterprise: { name: 'Enterprise', bytes: null },
};

export const isLockerPlan = (v: unknown): v is LockerPlanId => typeof v === 'string' && v in LOCKER_PLANS;

/** "1,2 GB", "340 MB", "12 KB" (vírgula ou ponto conforme o idioma). */
export function formatBytes(bytes: number, lang: 'pt' | 'en' | 'es' = 'pt'): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  // Uma casa só em GB e TB abaixo de 10, e só se não for redondo ("1,2 GB", "5 GB")
  const oneDecimal = value.toFixed(1);
  const digits = unit >= 3 && value < 10 && !oneDecimal.endsWith('.0') ? 1 : 0;
  const text = value.toFixed(digits);
  return `${lang === 'en' ? text : text.replace('.', ',')} ${units[unit]}`;
}
