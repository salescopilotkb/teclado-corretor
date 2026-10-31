/**
 * Passou do limite do plano: quais arquivos ficam se a pessoa não escolher. A
 * mesma regra da limpeza diária do servidor (supabase/functions/locker-purge):
 * os mais antigos ficam, pela data de envio, até o primeiro que não cabe no
 * plano (espaço ou número de arquivos); dali em diante, tudo sai.
 */
import type { SavedFile } from '../types';
import type { PlanLimits } from './plan';

/** Tamanho que conta no plano (link externo não ocupa espaço). */
export const countedSize = (f: SavedFile): number => (f.storagePath ? (f.size ?? 0) : 0);

/** Os ids que ficam se a pessoa não escolher. */
export function defaultKeep(files: SavedFile[], limits: PlanLimits): Set<string> {
  const ordered = [...files].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const keep = new Set<string>();
  let used = 0;
  for (const f of ordered) {
    const size = countedSize(f);
    if (limits.maxFiles !== null && keep.size >= limits.maxFiles) break;
    if (limits.limitBytes !== null && used + size > limits.limitBytes) break;
    keep.add(f.id);
    used += size;
  }
  return keep;
}

/** A escolha cabe no plano? */
export function fits(files: SavedFile[], keep: Set<string>, limits: PlanLimits): boolean {
  const kept = files.filter(f => keep.has(f.id));
  const used = kept.reduce((sum, f) => sum + countedSize(f), 0);
  return (limits.maxFiles === null || kept.length <= limits.maxFiles) && (limits.limitBytes === null || used <= limits.limitBytes);
}
