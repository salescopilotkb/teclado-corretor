/**
 * Locker de exemplo (nada vai ao servidor). Os arquivos são os mesmos do app de
 * demonstração (src/files/demoLocker.ts), com os nomes no idioma da página.
 *
 * Abre de dois jeitos:
 *  - demonstração pública: locker.keyconapp.com/?demo=1 (o botão "Abrir" da aba
 *    Locker no app de demonstração leva para cá); vale até fechar a aba;
 *  - desenvolvimento: ?preview (npm run locker:dev, ou um build com VITE_LOCKER_PREVIEW=1).
 */
import { DEMO_FILES, DEMO_FOLDERS, demoAgo, demoToken } from '../../src/files/demoLocker';
import { getLanguage } from '../../src/i18n';
import type { Lang } from '../../src/i18n';
import type { LockerData, LockerFile, LockerFolder, Usage } from './data';
import type { SharedData } from './sharing';

const query = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const DEMO_KEY = 'locker.demo';
if (query.has('demo')) sessionStorage.setItem(DEMO_KEY, '1');

/** Demonstração pública (sem conta): o Locker de exemplo, sem salvar nada. */
export const DEMO = query.has('demo') || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DEMO_KEY) === '1');

/** Locker de exemplo em vez da conta (demonstração ou prévia de desenvolvimento). */
export const PREVIEW = DEMO || ((import.meta.env.DEV || import.meta.env.VITE_LOCKER_PREVIEW === '1') && query.has('preview'));

/** Sair da demonstração: volta para a página de entrada de verdade. */
export function leaveDemo() {
  sessionStorage.removeItem(DEMO_KEY);
  location.href = '/';
}

export const DEMO_USER = { id: 'demo-user', email: 'rafael@keyconapp.com' };
const OTHER = 'demo-colega';

const lang = (): Lang => getLanguage();

const folderRow = (f: (typeof DEMO_FOLDERS)[number]): LockerFolder => ({
  id: f.id,
  user_id: DEMO_USER.id,
  parent_id: f.parent,
  name: f.name[lang()],
  position: 0,
  in_keyboard: f.inKeyboard ?? true,
  starred: !!f.starred,
  trashed_at: f.trashed ? demoAgo(6) : null,
  created_at: demoAgo(f.daysAgo + 3),
  updated_at: demoAgo(f.daysAgo),
  visibility: f.visibility ?? 'private',
  share_token: demoToken(f.id),
});

const fileRow = (f: (typeof DEMO_FILES)[number]): LockerFile => ({
  id: f.id,
  user_id: DEMO_USER.id,
  folder_id: f.folder,
  name: `${f.title[lang()]}.${f.ext}`,
  kind: f.mime.split('/')[0],
  mime: f.mime,
  size_bytes: Math.round(f.size),
  storage: 'link',
  object_key: '',
  url: f.art ?? '',
  duration: f.duration ?? null,
  position: 0,
  in_keyboard: f.inKeyboard ?? true,
  starred: !!f.starred,
  trashed_at: f.trashed ? demoAgo(3) : null,
  created_at: demoAgo(f.daysAgo),
  updated_at: demoAgo(f.daysAgo),
  share_token: demoToken(f.id),
});

export function demoData(): LockerData {
  return { folders: DEMO_FOLDERS.map(folderRow), files: DEMO_FILES.map(fileRow) };
}

/** O que uma colega "compartilhou" com a pessoa (seção Compartilhados comigo). */
export function demoShared(): SharedData {
  const l = lang();
  const names = {
    folder: { pt: 'Vitrine loja 2', en: 'Store 2 window', es: 'Vitrina tienda 2' }[l],
    photo: { pt: 'Foto da vitrine.jpg', en: 'Window photo.jpg', es: 'Foto de la vitrina.jpg' }[l],
    goals: { pt: 'Metas de novembro.pdf', en: 'November goals.pdf', es: 'Metas de noviembre.pdf' }[l],
  };
  const base = fileRow(DEMO_FILES[0]);
  const window2: LockerFolder = { ...folderRow(DEMO_FOLDERS[0]), id: 's-loja2', user_id: OTHER, name: names.folder, parent_id: null, starred: false, visibility: 'private', share_token: demoToken('s-loja2') };
  const photoFile: LockerFile = { ...base, id: 's1', user_id: OTHER, folder_id: 's-loja2', name: names.photo, starred: false, share_token: demoToken('s1') };
  const goals: LockerFile = { ...fileRow(DEMO_FILES[5]), id: 's2', user_id: OTHER, folder_id: null, name: names.goals, share_token: demoToken('s2') };
  return {
    folders: [window2],
    files: [photoFile, goals],
    shares: [
      { id: 'sh1', owner_id: OTHER, owner_email: 'ana@keyconapp.com', folder_id: 's-loja2', file_id: null, grantee_email: DEMO_USER.email, team_id: null, role: 'viewer', created_at: demoAgo(2) },
      { id: 'sh2', owner_id: OTHER, owner_email: 'ana@keyconapp.com', folder_id: null, file_id: 's2', grantee_email: DEMO_USER.email, team_id: null, role: 'viewer', created_at: demoAgo(1) },
    ],
  };
}

export const demoUsage = (): Usage => ({ used: Math.round(1.24 * 1024 * 1024 * 1024), limit: 5 * 1024 * 1024 * 1024, plan: 'basic' });

/** Páginas públicas de exemplo (/f/... e /d/...) para a prévia. */
export function demoPublic(q: string): unknown {
  const data = demoData();
  const asPublic = (f: LockerFile) => ({
    name: f.name,
    kind: f.kind,
    mime: f.mime,
    size: f.size_bytes,
    createdAt: f.created_at,
    url: f.url,
    download: f.url,
    link: `f/${f.share_token}`,
  });
  if (q.startsWith('f=')) return asPublic(data.files.find(f => f.id === 'a1')!);
  const sub = new URLSearchParams(q).get('sub');
  const at = sub ?? 'f-catalogo';
  const name = (id: string) => data.folders.find(f => f.id === id)?.name ?? '';
  return {
    folder: { id: at, name: name(at), root: { name: name('f-catalogo') } },
    path: sub ? [{ id: sub, name: name(sub) }] : [],
    folders: data.folders.filter(f => f.parent_id === at && !f.trashed_at).map(f => ({ id: f.id, name: f.name })),
    files: data.files.filter(f => f.folder_id === at && !f.trashed_at).map(asPublic),
  };
}
