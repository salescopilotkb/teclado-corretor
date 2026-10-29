/**
 * Persistência local (offline-first) com MMKV.
 *
 * Conta nova começa zerada: nenhum produto, atalho, agenda ou cliente de
 * exemplo. Os exemplos gravados por versões antigas são removidos uma vez
 * (ver purgeLegacyDemoData no fim do arquivo).
 */
import { MMKV } from 'react-native-mmkv';
import { isSegmentId } from '../segments/segments';
import { isLang } from '../i18n';
import { isMarketId } from '../i18n/markets';
import type {
  AudioShortcut,
  CRMLead,
  FileFolder,
  FilesData,
  KeyboardData,
  LinkShortcut,
  MenuTab,
  MediaItem,
  Product,
  ProductFolder,
  SavedFile,
  ScheduleItem,
  SegmentId,
  SellerProfile,
  ShortcutsData,
  TextShortcut,
  ThemePreference,
} from '../types';

export const storage = new MMKV({ id: 'corretor-keyboard' });

// As chaves não mudam: os dados já salvos no aparelho continuam valendo
const KEYS = {
  seller: 'broker.profile',
  folders: 'products.folders',
  shortcuts: 'user.shortcuts',
  agenda: 'user.agenda',
  crm: 'user.crm',
  /** Etiquetas criadas sem estar em nenhum cliente ainda (botão "Etiqueta" em Clientes). */
  crmTags: 'user.crmTags',
  files: 'user.files',
  theme: 'user.theme',
  authToken: 'auth.token',
  /** Conta dona dos dados deste aparelho (outra conta entrando = começa do zero). */
  userId: 'auth.userId',
  tutorialSeen: 'app.tutorialSeen',
  /** Passos do "Primeiros passos" que o app não consegue detectar sozinho. */
  stepsDone: 'app.stepsDone',
  legacyDemoPurged: 'app.legacyDemoPurged',
  /** Ordem dos botões do menu do teclado (segurar e arrastar). */
  menuOrder: 'keyboard.menuOrder',
} as const;

/** Ordem padrão do menu do teclado. */
export const DEFAULT_MENU_ORDER: MenuTab[] = ['files', 'products', 'shortcuts', 'agenda', 'crm', 'more'];

/** Dados do usuário (apagados ao criar conta ou ao trocar de conta). */
const USER_DATA_KEYS = [
  KEYS.seller,
  KEYS.folders,
  KEYS.shortcuts,
  KEYS.agenda,
  KEYS.crm,
  KEYS.crmTags,
  KEYS.files,
  KEYS.tutorialSeen,
  KEYS.stepsDone,
];

const DEFAULT_THEME: ThemePreference = 'dark';
const EMPTY_SELLER: SellerProfile = { name: '', business: '', phone: '', segment: 'general', language: 'en', market: 'US_EN' };
const EMPTY_SHORTCUTS: ShortcutsData = { texts: [], audios: [], links: [] };
const EMPTY_FILES: FilesData = { folders: [], files: [] };

function getJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function setJSON<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

/** Perfil salvo por versões antigas: agency → business; sem ramo = geral. */
type StoredSeller = Partial<SellerProfile> & { agency?: string };

/** Pasta salva pela versão antiga: neighborhood → description. */
type StoredFolder = ProductFolder & { neighborhood?: string };

function readSeller(): SellerProfile {
  const s = getJSON<StoredSeller>(KEYS.seller, EMPTY_SELLER);
  return {
    name: s.name ?? '',
    business: s.business ?? s.agency ?? '',
    phone: s.phone ?? '',
    segment: isSegmentId(s.segment) ? s.segment : 'general',
    // Perfis de antes dos idiomas: português, Brasil
    language: isLang(s.language) ? s.language : 'pt',
    market: isMarketId(s.market) ? s.market : 'BR',
  };
}

export const Repo = {
  getSeller: readSeller,
  setSeller: (s: SellerProfile) => setJSON(KEYS.seller, s),

  getSegment: (): SegmentId => readSeller().segment,

  getFolders: (): ProductFolder[] => {
    const list = getJSON<StoredFolder[]>(KEYS.folders, []);
    if (!Array.isArray(list)) return [];
    return list.map(({ neighborhood, ...f }) => ({
      ...f,
      description: f.description ?? neighborhood,
    }));
  },
  setFolders: (f: ProductFolder[]) => setJSON(KEYS.folders, f),

  getShortcuts: (): ShortcutsData => {
    const sc = getJSON<ShortcutsData>(KEYS.shortcuts, EMPTY_SHORTCUTS);
    return {
      texts: Array.isArray(sc?.texts) ? sc.texts : [],
      audios: Array.isArray(sc?.audios) ? sc.audios : [],
      // Atalhos salvos antes dos links não têm a lista
      links: Array.isArray(sc?.links) ? sc.links.filter(l => l && l.id && l.url) : [],
    };
  },
  setShortcuts: (s: ShortcutsData) => setJSON(KEYS.shortcuts, s),

  /** Compromissos válidos, em ordem de dia e hora (sem hora = antes, o dia todo). */
  getAgenda: (): ScheduleItem[] => {
    const list = getJSON<ScheduleItem[]>(KEYS.agenda, []);
    if (!Array.isArray(list)) return [];
    return list
      .filter(a => a && typeof a.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.date))
      .sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`));
  },
  setAgenda: (a: ScheduleItem[]) => setJSON(KEYS.agenda, a),

  getCRM: (): CRMLead[] => {
    const list = getJSON<CRMLead[]>(KEYS.crm, []);
    return Array.isArray(list) ? list : [];
  },
  setCRM: (c: CRMLead[]) => setJSON(KEYS.crm, c),

  getCrmTags: (): string[] => {
    const list = getJSON<string[]>(KEYS.crmTags, []);
    return Array.isArray(list) ? list.filter(x => typeof x === 'string' && x.trim()) : [];
  },
  setCrmTags: (tags: string[]) => setJSON(KEYS.crmTags, tags),

  /** Cria a etiqueta (sem repetir maiúscula/minúscula). */
  addCrmTag(tag: string): void {
    const list = this.getCrmTags();
    if (!list.some(x => x.toLowerCase() === tag.toLowerCase())) this.setCrmTags([...list, tag]);
  },

  /** Exclui a etiqueta da lista e de todos os clientes. */
  deleteCrmTag(tag: string): void {
    const key = tag.toLowerCase();
    this.setCrmTags(this.getCrmTags().filter(x => x.toLowerCase() !== key));
    this.setCRM(
      this.getCRM().map(l => (l.tags?.some(x => x.toLowerCase() === key) ? { ...l, tags: l.tags.filter(x => x.toLowerCase() !== key) } : l)),
    );
  },

  getFiles: (): FilesData => {
    const data = getJSON<FilesData>(KEYS.files, EMPTY_FILES);
    return {
      folders: Array.isArray(data?.folders) ? data.folders.filter(f => f && f.id) : [],
      files: Array.isArray(data?.files) ? data.files.filter(f => f && f.id && f.url) : [],
    };
  },
  setFiles: (f: FilesData) => setJSON(KEYS.files, f),

  /** Ordem salva; botões novos (de versões futuras) entram no fim, os que saíram somem. */
  getMenuOrder: (): MenuTab[] => {
    const saved = getJSON<string[]>(KEYS.menuOrder, []);
    const known = (Array.isArray(saved) ? saved : []).filter((k): k is MenuTab => DEFAULT_MENU_ORDER.includes(k as MenuTab));
    const unique = [...new Set(known)];
    return [...unique, ...DEFAULT_MENU_ORDER.filter(k => !unique.includes(k))];
  },
  setMenuOrder: (order: MenuTab[]) => setJSON(KEYS.menuOrder, order),

  getTheme: (): ThemePreference => (storage.getString(KEYS.theme) as ThemePreference) || DEFAULT_THEME,
  setTheme: (t: ThemePreference) => storage.set(KEYS.theme, t),

  getAuthToken: (): string | undefined => storage.getString(KEYS.authToken),
  /** O teclado usa o mesmo armazenamento do app: logado no app = logado no teclado. */
  isLoggedIn: (): boolean => !!storage.getString(KEYS.authToken),
  setAuthToken: (t: string) => storage.set(KEYS.authToken, t),
  clearAuth: () => storage.delete(KEYS.authToken),

  getUserId: (): string | undefined => storage.getString(KEYS.userId),
  setUserId: (id: string) => storage.set(KEYS.userId, id),

  /** Apaga perfil, catálogo, atalhos, agenda, CRM e o progresso do tutorial. */
  clearUserData(): void {
    for (const key of USER_DATA_KEYS) storage.delete(key);
  },

  isTutorialSeen: (): boolean => storage.getBoolean(KEYS.tutorialSeen) === true,
  setTutorialSeen: () => storage.set(KEYS.tutorialSeen, true),

  getStepsDone: (): string[] => getJSON<string[]>(KEYS.stepsDone, []),
  markStepDone(step: string): void {
    const done = this.getStepsDone();
    if (!done.includes(step)) setJSON(KEYS.stepsDone, [...done, step]);
  },

  // ── CRM e agenda: o app e o teclado gravam no mesmo lugar ────────────

  /** Cria ou atualiza o cliente (pelo id). */
  saveLead(lead: CRMLead): void {
    const list = this.getCRM();
    const exists = list.some(l => l.id === lead.id);
    this.setCRM(exists ? list.map(l => (l.id === lead.id ? lead : l)) : [lead, ...list]);
  },

  /** Exclui o cliente e solta os compromissos ligados a ele (eles continuam na agenda). */
  deleteLead(id: string): void {
    this.setCRM(this.getCRM().filter(l => l.id !== id));
    this.setAgenda(this.getAgenda().map(a => (a.clientId === id ? { ...a, clientId: undefined } : a)));
  },

  /** Cria ou atualiza o compromisso (pelo id). */
  saveAgendaItem(item: ScheduleItem): void {
    const list = this.getAgenda();
    const exists = list.some(a => a.id === item.id);
    this.setAgenda(exists ? list.map(a => (a.id === item.id ? item : a)) : [...list, item]);
  },

  deleteAgendaItem(id: string): void {
    this.setAgenda(this.getAgenda().filter(a => a.id !== id));
  },

  // ── Arquivos: o app e o teclado gravam no mesmo lugar ────────────────

  /** Cria ou atualiza a pasta (pelo id). */
  saveFileFolder(folder: FileFolder): void {
    const data = this.getFiles();
    const exists = data.folders.some(f => f.id === folder.id);
    this.setFiles({ ...data, folders: exists ? data.folders.map(f => (f.id === folder.id ? folder : f)) : [...data.folders, folder] });
  },

  /**
   * Exclui a pasta com as subpastas e os arquivos de dentro. Devolve os
   * arquivos excluídos (para apagar da nuvem os que foram enviados).
   */
  deleteFileFolder(folderId: string): SavedFile[] {
    const data = this.getFiles();
    const doomed = new Set([folderId]);
    // Subpastas de qualquer nível
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of data.folders) {
        if (f.parentId && doomed.has(f.parentId) && !doomed.has(f.id)) {
          doomed.add(f.id);
          grew = true;
        }
      }
    }
    const removed = data.files.filter(f => f.folderId && doomed.has(f.folderId));
    this.setFiles({
      folders: data.folders.filter(f => !doomed.has(f.id)),
      files: data.files.filter(f => !(f.folderId && doomed.has(f.folderId))),
    });
    return removed;
  },

  /** Cria ou atualiza o arquivo (pelo id): renomear e mover também passam aqui. */
  saveFile(file: SavedFile): void {
    const data = this.getFiles();
    const exists = data.files.some(f => f.id === file.id);
    this.setFiles({ ...data, files: exists ? data.files.map(f => (f.id === file.id ? file : f)) : [...data.files, file] });
  },

  deleteFile(id: string): void {
    const data = this.getFiles();
    this.setFiles({ ...data, files: data.files.filter(f => f.id !== id) });
  },

  addFolder(folder: ProductFolder): void {
    const folders = this.getFolders();
    this.setFolders([...folders, folder]);
  },

  /** Atualiza nome e descrição da pasta (os produtos dentro dela são mantidos). */
  updateFolder(folderId: string, changes: Pick<ProductFolder, 'name' | 'description'>): void {
    this.setFolders(this.getFolders().map(f => (f.id === folderId ? { ...f, ...changes } : f)));
  },

  /** Exclui a pasta e todos os produtos dela. */
  deleteFolder(folderId: string): void {
    this.setFolders(this.getFolders().filter(f => f.id !== folderId));
  },

  addProduct(folderId: string, product: Product): void {
    const folders = this.getFolders().map(f => {
      if (f.id === folderId) {
        return { ...f, products: [...f.products, product] };
      }
      return f;
    });
    this.setFolders(folders);
  },

  /** Aplica uma alteração em um produto específico de uma pasta. */
  mapProduct(folderId: string, productId: string, fn: (p: Product) => Product): void {
    const folders = this.getFolders().map(f => {
      if (f.id !== folderId) return f;
      return { ...f, products: f.products.map(p => (p.id === productId ? fn(p) : p)) };
    });
    this.setFolders(folders);
  },

  updateProduct(folderId: string, product: Product): void {
    this.mapProduct(folderId, product.id, () => product);
  },

  deleteProduct(folderId: string, productId: string): void {
    const folders = this.getFolders().map(f =>
      f.id === folderId ? { ...f, products: f.products.filter(p => p.id !== productId) } : f,
    );
    this.setFolders(folders);
  },

  /** Adiciona um link de foto ou vídeo ao produto (conforme media.type). */
  addMedia(folderId: string, productId: string, media: MediaItem): void {
    this.mapProduct(folderId, productId, p =>
      media.type === 'image'
        ? { ...p, photos: [...p.photos, media] }
        : { ...p, videos: [...p.videos, media] },
    );
  },

  deleteMedia(folderId: string, productId: string, mediaId: string): void {
    this.mapProduct(folderId, productId, p => ({
      ...p,
      photos: p.photos.filter(m => m.id !== mediaId),
      videos: p.videos.filter(m => m.id !== mediaId),
    }));
  },

  addTextShortcut(shortcut: TextShortcut): void {
    const sc = this.getShortcuts();
    this.setShortcuts({
      ...sc,
      texts: [...sc.texts, shortcut],
    });
  },

  updateTextShortcut(shortcut: TextShortcut): void {
    const sc = this.getShortcuts();
    this.setShortcuts({
      ...sc,
      texts: sc.texts.map(t => (t.id === shortcut.id ? shortcut : t)),
    });
  },

  deleteTextShortcut(id: string): void {
    const sc = this.getShortcuts();
    this.setShortcuts({ ...sc, texts: sc.texts.filter(t => t.id !== id) });
  },

  addAudioShortcut(shortcut: AudioShortcut): void {
    const sc = this.getShortcuts();
    this.setShortcuts({
      ...sc,
      audios: [...sc.audios, shortcut],
    });
  },

  updateAudioShortcut(shortcut: AudioShortcut): void {
    const sc = this.getShortcuts();
    this.setShortcuts({
      ...sc,
      audios: sc.audios.map(a => (a.id === shortcut.id ? shortcut : a)),
    });
  },

  deleteAudioShortcut(id: string): void {
    const sc = this.getShortcuts();
    this.setShortcuts({ ...sc, audios: sc.audios.filter(a => a.id !== id) });
  },

  /** Cria ou atualiza o atalho de link (pelo id). */
  saveLinkShortcut(link: LinkShortcut): void {
    const sc = this.getShortcuts();
    const exists = sc.links.some(l => l.id === link.id);
    this.setShortcuts({ ...sc, links: exists ? sc.links.map(l => (l.id === link.id ? link : l)) : [...sc.links, link] });
  },

  deleteLinkShortcut(id: string): void {
    const sc = this.getShortcuts();
    this.setShortcuts({ ...sc, links: sc.links.filter(l => l.id !== id) });
  },

  loadAll(): KeyboardData {
    return {
      seller: this.getSeller(),
      folders: this.getFolders(),
      shortcuts: this.getShortcuts(),
      agenda: this.getAgenda(),
      crm: this.getCRM(),
      files: this.getFiles(),
      theme: this.getTheme(),
    };
  },
};

/**
 * Remove, uma única vez, os exemplos que versões anteriores gravavam no
 * aparelho. Itens criados pelo usuário têm ids com data e hora
 * ("folder-1730000000000"), então não são confundidos com estes. Uma pasta de
 * exemplo em que o usuário cadastrou algo continua, só sem os itens de exemplo.
 */
const LEGACY_DEMO_IDS = {
  folders: ['villa-bella', 'residencial-central', 'colecao-verao', 'acessorios'],
  products: ['vb-01', 'vb-02', 'rc-01', 'cv-01', 'cv-02', 'ac-01'],
  texts: ['t1', 't2', 't3', 't4'],
  audios: ['a1', 'a2'],
  agenda: ['ag-1', 'ag-2'],
  crm: ['crm-1', 'crm-2'],
};

function purgeLegacyDemoData(): void {
  if (storage.getBoolean(KEYS.legacyDemoPurged)) return;
  const drop = <T extends { id: string }>(list: T[], ids: string[]) => list.filter(x => !ids.includes(x.id));

  if (storage.contains(KEYS.folders)) {
    const folders = Repo.getFolders()
      .map(f => ({ ...f, products: drop(f.products, LEGACY_DEMO_IDS.products) }))
      .filter(f => !(LEGACY_DEMO_IDS.folders.includes(f.id) && f.products.length === 0));
    Repo.setFolders(folders);
  }
  if (storage.contains(KEYS.shortcuts)) {
    const sc = Repo.getShortcuts();
    Repo.setShortcuts({ ...sc, texts: drop(sc.texts, LEGACY_DEMO_IDS.texts), audios: drop(sc.audios, LEGACY_DEMO_IDS.audios) });
  }
  if (storage.contains(KEYS.agenda)) Repo.setAgenda(drop(Repo.getAgenda(), LEGACY_DEMO_IDS.agenda));
  if (storage.contains(KEYS.crm)) Repo.setCRM(drop(Repo.getCRM(), LEGACY_DEMO_IDS.crm));

  // Perfil de demonstração ("Ana Souza / Bella Store") gravado antes do login
  const seller = readSeller();
  if (seller.name === 'Ana Souza' && ['Bella Store', 'Prime Imóveis'].includes(seller.business)) {
    storage.delete(KEYS.seller);
  }
  storage.set(KEYS.legacyDemoPurged, true);
}

try {
  purgeLegacyDemoData();
} catch {
  // Limpeza é só conveniência: nunca impede o app ou o teclado de abrir
}
