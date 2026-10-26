/**
 * Regras dos atalhos usadas pelo app e pelo teclado: validar, salvar e
 * excluir atalhos de texto, áudio e link, e montar o que vai para a conversa.
 * Os dois lados gravam no mesmo lugar (Repo).
 */
import { t, tSell } from '../i18n';
import { deleteUploadedMedia } from '../services/mediaUpload';
import { Repo } from '../storage/storage';
import type { AudioShortcut, LinkShortcut, TextShortcut } from '../types';
import { normalizeUrl } from '../utils/formatters';

export type ShortcutKind = 'text' | 'audio' | 'link';

type Saved<T> = { ok: true; item: T } | { ok: false; error: string };

const newId = (kind: ShortcutKind) => `${kind}-${Date.now()}`;

/** "[Áudio 0:20] Boas-vindas: https://..." — quando o app não recebe o arquivo. */
export function audioLink(a: AudioShortcut): string {
  return `[${tSell('Áudio')}${a.duration ? ` ${a.duration}` : ''}] ${a.title}: ${a.audioUrl}`;
}

/** O que vai para a conversa: a mensagem (se tiver) e o link. */
export function linkMessage(l: LinkShortcut): string {
  const message = l.message?.trim();
  return message ? `${message} ${l.url}` : l.url;
}

export function saveTextShortcut(id: string | null, title: string, text: string): Saved<TextShortcut> {
  if (!title.trim()) return { ok: false, error: t('Informe o título do atalho.') };
  if (!text.trim()) return { ok: false, error: t('Escreva a mensagem do atalho.') };
  const item: TextShortcut = { id: id ?? newId('text'), title: title.trim(), text: text.trim() };
  if (id) Repo.updateTextShortcut(item);
  else Repo.addTextShortcut(item);
  return { ok: true, item };
}

export function saveLinkShortcut(id: string | null, title: string, url: string, message: string): Saved<LinkShortcut> {
  if (!title.trim()) return { ok: false, error: t('Informe o título do atalho.') };
  const clean = normalizeUrl(url);
  if (!clean) return { ok: false, error: t('O link não parece válido. Ex: https://seusite.com.br/pagina') };
  const item: LinkShortcut = { id: id ?? newId('link'), title: title.trim(), url: clean, message: message.trim() || undefined };
  Repo.saveLinkShortcut(item);
  return { ok: true, item };
}

/** Áudio já enviado para a nuvem (gravado ou escolhido do celular). */
export interface AudioDraft {
  audioUrl: string;
  storagePath?: string;
  duration: string;
}

/**
 * Salva o atalho de áudio. Trocou o áudio de um atalho que já existia: o
 * arquivo antigo sai da nuvem. A transcrição de antes continua.
 */
export function saveAudioShortcut(previous: AudioShortcut | null, title: string, audio: AudioDraft | null): Saved<AudioShortcut> {
  if (!title.trim()) return { ok: false, error: t('Informe o título do atalho.') };
  if (!audio?.audioUrl) return { ok: false, error: t('Grave ou escolha um áudio.') };
  const item: AudioShortcut = {
    id: previous?.id ?? newId('audio'),
    title: title.trim(),
    audioUrl: audio.audioUrl,
    storagePath: audio.storagePath,
    duration: audio.duration,
    transcript: previous?.transcript ?? '',
  };
  if (previous) {
    if (previous.storagePath && previous.storagePath !== audio.storagePath) deleteUploadedMedia(previous.storagePath);
    Repo.updateAudioShortcut(item);
  } else Repo.addAudioShortcut(item);
  return { ok: true, item };
}

export function deleteShortcut(kind: ShortcutKind, id: string): void {
  if (kind === 'text') Repo.deleteTextShortcut(id);
  else if (kind === 'link') Repo.deleteLinkShortcut(id);
  else {
    const audio = Repo.getShortcuts().audios.find(a => a.id === id);
    Repo.deleteAudioShortcut(id);
    deleteUploadedMedia(audio?.storagePath);
  }
}
