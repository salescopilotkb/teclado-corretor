/**
 * A tela do Locker web, no desenho do Google Drive com a cara da KEYCON:
 * barra de cima (busca e conta), menu lateral (Novo, Meu Locker, Recentes,
 * Com estrela, Lixeira e o medidor de espaço) e a área dos arquivos, em grade
 * ou lista, com o caminho clicável no topo.
 *
 * O endereço guarda onde a pessoa está (?pasta=<id> ou ?ver=recentes...), então
 * o voltar do navegador e o recarregar funcionam como no Drive.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { t } from '../../src/i18n';
import { copyFiles, deleteForever, descendants, download, moveTo, rename, setStarred, setTrashed } from './actions';
import type { Selection } from './actions';
import { Browser, itemId, itemName, sortItems } from './Browser';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu } from './ContextMenu';
import type { MenuEntry } from './ContextMenu';
import type { Item, Layout, Sort } from './Browser';
import { fetchLocker, fetchUsage, fileType, lockerLink, supabase, watchLocker } from './data';
import type { FileType, LockerData, LockerFile, Usage } from './data';
import { Icon } from './icons';
import type { IconName } from './icons';
import { setInKeyboard } from './keyboard';
import { KeyboardView } from './KeyboardView';
import { MoveDialog } from './MoveDialog';
import { NameDialog } from './NameDialog';
import { Preview } from './Preview';
import { ShareDialog } from './ShareDialog';
import { EMPTY_SHARED, fetchShared } from './sharing';
import type { SharedData } from './sharing';
import { TeamsView } from './TeamsView';
import { clearOffline, loadLocalCopies, loadSnapshot, makeOffline, offlineList, refreshOffline, removeOffline, saveSnapshot, useOnline } from './offline';
import { pickedFromDrop, pickedFromInput, replaceUpload, startUploads } from './upload';
import type { PickedFile } from './upload';
import { UploadPanel } from './UploadPanel';
import { UsageMeter } from './UsageMeter';
import { LanguagePicker } from './LanguagePicker';
import { DEMO, leaveDemo, PREVIEW } from './demo';
import { useLanguage } from '../../src/i18n/useLanguage';

export type Section = 'drive' | 'shared' | 'recent' | 'starred' | 'offline' | 'trash' | 'keyboard' | 'teams';

type Place = { section: Section; folderId: string | null };

const SECTION_PARAM: Record<Exclude<Section, 'drive'>, string> = {
  shared: 'compartilhados',
  recent: 'recentes',
  starred: 'estrela',
  trash: 'lixeira',
  keyboard: 'teclado',
  teams: 'equipes',
  offline: 'sem-internet',
};

function readPlace(): Place {
  const q = new URLSearchParams(location.search);
  const ver = q.get('ver');
  const section = (Object.keys(SECTION_PARAM) as Array<keyof typeof SECTION_PARAM>).find(k => SECTION_PARAM[k] === ver);
  // Compartilhados comigo também guarda a pasta aberta
  if (section === 'shared') return { section, folderId: q.get('pasta') };
  return section ? { section, folderId: null } : { section: 'drive', folderId: q.get('pasta') };
}

function placeUrl(p: Place): string {
  if (p.section === 'shared' && p.folderId) return `/?ver=${SECTION_PARAM.shared}&pasta=${encodeURIComponent(p.folderId)}`;
  if (p.section !== 'drive') return `/?ver=${SECTION_PARAM[p.section]}`;
  return p.folderId ? `/?pasta=${encodeURIComponent(p.folderId)}` : '/';
}

/** Menu lateral em grupos (como o Drive), com uma linha entre eles. */
const NAV: Array<{ section: Section; label: string; icon: IconName; group: number }> = [
  { section: 'drive', label: 'Meu Locker', icon: 'drive', group: 1 },
  { section: 'keyboard', label: 'Teclado', icon: 'keyboard', group: 1 },
  { section: 'shared', label: 'Compartilhados comigo', icon: 'team', group: 2 },
  { section: 'teams', label: 'Equipes', icon: 'team', group: 2 },
  { section: 'recent', label: 'Recentes', icon: 'clock', group: 3 },
  { section: 'starred', label: 'Com estrela', icon: 'star', group: 3 },
  { section: 'offline', label: 'Disponível sem internet', icon: 'offline', group: 3 },
  { section: 'trash', label: 'Lixeira', icon: 'trash', group: 4 },
];

const TRASH_DAYS = 30;

/** Filtros da busca (como os do Drive): tipo e data de modificação. */
type TypeFilter = Exclude<FileType, 'other'> | 'folder';
type DateFilter = 'today' | '7d' | '30d' | 'year';

const TYPE_FILTERS: Array<{ id: TypeFilter; label: string; icon: IconName }> = [
  { id: 'folder', label: 'Pastas', icon: 'folder' },
  { id: 'image', label: 'Imagens', icon: 'image' },
  { id: 'video', label: 'Vídeos', icon: 'video' },
  { id: 'audio', label: 'Áudios', icon: 'audio' },
  { id: 'pdf', label: 'PDFs', icon: 'pdf' },
  { id: 'document', label: 'Documentos', icon: 'document' },
];

const DATE_FILTERS: Array<{ id: DateFilter; label: string }> = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'year', label: 'Este ano' },
];

/** Desde quando vale cada filtro de data (ms). */
function dateFrom(f: DateFilter): number {
  const d = new Date();
  if (f === 'year') return new Date(d.getFullYear(), 0, 1).getTime();
  d.setHours(0, 0, 0, 0);
  return d.getTime() - (f === '7d' ? 6 : f === '30d' ? 29 : 0) * 86400000;
}

/** Para a busca: sem acento e sem diferença de maiúsculas ("cafe" acha "Café"). */
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export function Drive({ session }: { session: Session }) {
  const userId = session.user.id;
  const [data, setData] = useState<LockerData>({ folders: [], files: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  /** O que outras contas compartilharam comigo, e o que eu compartilhei (para o ícone). */
  const [shared, setShared] = useState<SharedData>(EMPTY_SHARED);
  const [sharedByMe, setSharedByMe] = useState<Set<string>>(() => new Set());
  const online = useOnline();
  /** Mostrando a cópia guardada (sem internet): quando ela foi salva. */
  const [savedCopyAt, setSavedCopyAt] = useState<string | null>(null);
  const [offlineIds, setOfflineIds] = useState<Set<string>>(() => new Set(Object.keys(offlineList(userId))));
  const syncOfflineIds = useCallback(() => setOfflineIds(new Set(Object.keys(offlineList(userId)))), [userId]);
  const [place, setPlace] = useState<Place>(readPlace);
  const [query, setQuery] = useState('');
  // Sem escolha salva: lista no celular (como o Drive), grade no computador
  const [layout, setLayout] = useState<Layout>(() => {
    const saved = localStorage.getItem('locker.layout');
    if (saved === 'list' || saved === 'grid') return saved;
    return matchMedia('(max-width: 760px)').matches ? 'list' : 'grid';
  });
  const layoutChosen = useRef(!!localStorage.getItem('locker.layout'));
  const [sort, setSort] = useState<Sort>(() => {
    try {
      return { by: 'name', dir: 'asc', ...JSON.parse(localStorage.getItem('locker.sort') || '{}') };
    } catch {
      return { by: 'name', dir: 'asc' };
    }
  });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreatingRaw] = useState(false);
  const setCreating = (v: boolean) => (v && demoBlocked() ? undefined : setCreatingRaw(v));
  const [accountOpen, setAccountOpen] = useState(false);
  /** Arrastando arquivos sobre a página: a pasta onde vão cair (undefined = não está arrastando). */
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined);
  const [toast, setToast] = useState('');
  /** "Desfazer" do aviso (lixeira, mover). */
  const [undo, setUndo] = useState<(() => void) | null>(null);
  /** Menu do botão direito / ⋮ (item null = fundo da página). */
  const [menu, setMenu] = useState<{ x: number; y: number; item: Item | null } | null>(null);
  const [renaming, setRenamingRaw] = useState<Item | null>(null);
  const setRenaming = (v: Item | null) => (v && demoBlocked() ? undefined : setRenamingRaw(v));
  const [moving, setMovingRaw] = useState<Selection | null>(null);
  const setMoving = (v: Selection | null) => (v && demoBlocked() ? undefined : setMovingRaw(v));
  const [confirming, setConfirmingRaw] = useState<{ title: string; text: string; confirm: string; run: () => Promise<void> } | null>(null);
  const setConfirming = (v: typeof confirming) => (v && demoBlocked() ? undefined : setConfirmingRaw(v));
  const searchInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const placeRef = useRef(place);
  placeRef.current = place;
  const openPreview = (id: string) => {
    setPreview(id);
    history.pushState({ preview: true }, '', location.href);
  };
  const closePreview = useCallback(() => {
    if (history.state?.preview) history.back();
    else setPreview(null);
  }, []);
  type Sharing = { kind: 'folder'; folder: LockerData['folders'][number] } | { kind: 'file'; file: LockerFile } | null;
  const [sharing, setSharingRaw] = useState<Sharing>(null);
  const setSharing = (v: Sharing) => (v && demoBlocked() ? undefined : setSharingRaw(v));
  const [typeFilter, setTypeFilter] = useState<TypeFilter | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [filterMenu, setFilterMenu] = useState<{ kind: 'type' | 'date'; x: number; y: number } | null>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  /** "Trocar por nova versão": o campo de escolher e o arquivo que vai ser trocado. */
  const versionInput = useRef<HTMLInputElement>(null);
  const versionTarget = useRef<LockerFile | null>(null);

  // ---------------------------------------------------------------------------
  // Dados: carrega, ouve as mudanças em tempo real e atualiza o medidor
  // ---------------------------------------------------------------------------
  const reload = useCallback(async () => {
    try {
      const next = await fetchLocker(userId);
      setData(next);
      setLoadError(false);
      setSavedCopyAt(null);
      Promise.all([fetchShared(userId).catch(() => EMPTY_SHARED), fetchUsage(next)]).then(([sh, us]) => {
        setShared(sh);
        setUsage(us);
        // A cópia para quando a internet cair, e os arquivos guardados em dia
        saveSnapshot(userId, { data: next, shared: sh, usage: us });
        refreshOffline(userId, [...next.files, ...sh.files]).then(changed => changed && syncOfflineIds());
      });
      supabase
        .from('locker_shares')
        .select('folder_id, file_id')
        .eq('owner_id', userId)
        .then(({ data: rows }) => setSharedByMe(new Set((rows ?? []).map(r => (r.folder_id ?? r.file_id) as string))));
    } catch {
      // Sem internet: a última cópia guardada neste aparelho
      const snap = await loadSnapshot(userId);
      if (snap) {
        setData(snap.data);
        setShared(snap.shared ?? EMPTY_SHARED);
        setUsage(snap.usage);
        setSavedCopyAt(snap.savedAt);
        setLoadError(false);
      } else setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, [userId, syncOfflineIds]);

  // Os arquivos guardados já aparecem nas miniaturas e na prévia
  useEffect(() => {
    loadLocalCopies(userId).then(syncOfflineIds);
  }, [userId, syncOfflineIds]);

  // A internet voltou: atualiza
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) reload();
    wasOnline.current = online;
  }, [online, reload]);

  useEffect(() => {
    reload();
    const stop = watchLocker(userId, reload);
    // Voltou para a aba: confere se algo mudou enquanto estava fora
    const onFocus = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [userId, reload]);

  // ---------------------------------------------------------------------------
  // Navegação (com o voltar do navegador)
  // ---------------------------------------------------------------------------
  const go = useCallback((p: Place) => {
    setPlace(p);
    setSelected(new Set());
    setQuery('');
    setTypeFilter(null);
    setDateFilter(null);
    setMenuOpen(false);
    history.pushState(null, '', placeUrl(p));
  }, []);

  useEffect(() => {
    const onPop = () => {
      // O voltar do celular fecha a prévia (ela entra no histórico) sem sair da pasta
      setPreview(null);
      const next = readPlace();
      const now = placeRef.current;
      if (next.section === now.section && next.folderId === now.folderId) return;
      setPlace(next);
      setSelected(new Set());
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (layoutChosen.current) localStorage.setItem('locker.layout', layout);
  }, [layout]);
  const chooseLayout = (l: Layout) => {
    layoutChosen.current = true;
    setLayout(l);
  };
  useEffect(() => localStorage.setItem('locker.sort', JSON.stringify(sort)), [sort]);

  // ---------------------------------------------------------------------------
  // O que aparece na área dos arquivos
  // ---------------------------------------------------------------------------
  const folderById = useMemo(() => new Map(data.folders.map(f => [f.id, f])), [data.folders]);

  /** Pasta (ou alguma acima dela) está na lixeira. */
  const inTrash = useCallback(
    (folderId: string | null): boolean => {
      for (let id = folderId, guard = 0; id && guard < 64; guard++) {
        const f = folderById.get(id);
        if (!f) return false;
        if (f.trashed_at) return true;
        id = f.parent_id;
      }
      return false;
    },
    [folderById],
  );

  /** Caminho da pasta aberta até o Meu Locker (sem a raiz). */
  const path = useMemo(() => {
    const out = [];
    for (let id = place.folderId, guard = 0; id && guard < 64; guard++) {
      const f = folderById.get(id);
      if (!f) break;
      out.unshift(f);
      id = f.parent_id;
    }
    return out;
  }, [place.folderId, folderById]);

  /** Compartilhados comigo: o que veio direto (a raiz) e quem compartilhou. */
  const sharedRoots = useMemo(() => new Set(shared.shares.map(s => (s.folder_id ?? s.file_id) as string)), [shared.shares]);
  const sharedFolderById = useMemo(() => new Map(shared.folders.map(f => [f.id, f])), [shared.folders]);
  const ownerEmail = useMemo(() => new Map(shared.shares.map(s => [s.owner_id, s.owner_email])), [shared.shares]);
  const sharedPath = useMemo(() => {
    const out = [];
    for (let id = place.section === 'shared' ? place.folderId : null, guard = 0; id && guard < 64; guard++) {
      const f = sharedFolderById.get(id);
      if (!f) break;
      out.unshift(f);
      if (sharedRoots.has(f.id)) break;
      id = f.parent_id;
    }
    return out;
  }, [place, sharedFolderById, sharedRoots]);
  /** Só ver e baixar (o que é de outra conta). */
  const readOnly = place.section === 'shared' && !query.trim();
  /** De onde vêm os itens da tela (para a seleção, baixar e a prévia). */
  const pool: LockerData = readOnly ? shared : data;

  const items: Item[] = useMemo(() => {
    const folders = data.folders.map<Item>(f => ({ kind: 'folder', folder: f }));
    const files = data.files.map<Item>(f => ({ kind: 'file', file: f }));
    const alive = (i: Item) => (i.kind === 'folder' ? !i.folder.trashed_at && !inTrash(i.folder.parent_id) : !i.file.trashed_at && !inTrash(i.file.folder_id));
    const q = fold(query.trim());
    const since = dateFilter ? dateFrom(dateFilter) : 0;
    const matches = (i: Item) => {
      if (typeFilter && (typeFilter === 'folder' ? i.kind !== 'folder' : i.kind !== 'file' || fileType(i.file) !== typeFilter)) return false;
      if (since && Date.parse(i.kind === 'folder' ? i.folder.updated_at : i.file.updated_at) < since) return false;
      return true;
    };
    if (q) return [...folders, ...files].filter(i => alive(i) && matches(i) && fold(i.kind === 'folder' ? i.folder.name : i.file.name).includes(q));
    return base().filter(matches);
    function base(): Item[] {
    switch (place.section) {
      case 'shared': {
        const sf = shared.folders.map<Item>(f => ({ kind: 'folder', folder: f }));
        const sfiles = shared.files.map<Item>(f => ({ kind: 'file', file: f }));
        if (!place.folderId) return [...sf, ...sfiles].filter(i => sharedRoots.has(itemId(i)));
        return [
          ...sf.filter(i => i.kind === 'folder' && i.folder.parent_id === place.folderId),
          ...sfiles.filter(i => i.kind === 'file' && i.file.folder_id === place.folderId),
        ];
      }
      case 'offline':
        return [...files, ...shared.files.map<Item>(f => ({ kind: 'file', file: f }))].filter(i => i.kind === 'file' && offlineIds.has(i.file.id) && !i.file.trashed_at);
      case 'keyboard':
      case 'teams':
        return [];
      case 'recent':
        return files.filter(alive);
      case 'starred':
        return [...folders, ...files].filter(i => alive(i) && (i.kind === 'folder' ? i.folder.starred : i.file.starred));
      case 'trash':
        // Só o que foi para a lixeira direto (o que estava dentro de uma pasta vai junto com ela)
        return [...folders, ...files].filter(i => (i.kind === 'folder' ? !!i.folder.trashed_at && !inTrash(i.folder.parent_id) : !!i.file.trashed_at && !inTrash(i.file.folder_id)));
      default:
        return [
          ...folders.filter(i => i.kind === 'folder' && i.folder.parent_id === place.folderId && alive(i)),
          ...files.filter(i => i.kind === 'file' && i.file.folder_id === place.folderId && alive(i)),
        ];
    }
    }
  }, [data, shared, sharedRoots, place, query, inTrash, typeFilter, dateFilter, offlineIds]);

  // Pasta do endereço não existe mais (apagada no app, por exemplo): volta ao início
  useEffect(() => {
    if (loaded && place.section === 'drive' && place.folderId && (!folderById.has(place.folderId) || inTrash(place.folderId))) go({ section: 'drive', folderId: null });
    if (loaded && place.section === 'shared' && place.folderId && shared.shares.length && !sharedFolderById.has(place.folderId)) go({ section: 'shared', folderId: null });
  }, [loaded, place, folderById, inTrash, go, shared.shares.length, sharedFolderById]);

  const locationOf = useCallback((folderId: string | null) => (folderId ? folderById.get(folderId)?.name ?? '' : t('Meu Locker')), [folderById]);
  const locationOfItem = (item: Item) => {
    const row = item.kind === 'folder' ? item.folder : item.file;
    if (row.user_id !== userId) return ownerEmail.get(row.user_id) ?? '';
    return locationOf(item.kind === 'folder' ? item.folder.parent_id : item.file.folder_id);
  };

  // ---------------------------------------------------------------------------
  // Ações desta parte: abrir e criar pasta (as outras chegam nas próximas partes)
  // ---------------------------------------------------------------------------
  const openItem = (item: Item) => {
    if (place.section === 'trash') return;
    if (item.kind === 'folder') return go({ section: item.folder.user_id === userId ? 'drive' : 'shared', folderId: item.folder.id });
    openPreview(item.file.id);
  };

  const createFolder = async (name: string) => {
    const parent = place.section === 'drive' ? place.folderId : null;
    const id = `ffolder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from('locker_folders').insert({ id, name, parent_id: parent });
    if (error) throw error;
    await reload();
    setSelected(new Set([id]));
  };

  // ---------------------------------------------------------------------------
  // Envio: botão Novo (arquivos ou pasta) e arrastar para a página
  // ---------------------------------------------------------------------------
  /** Pasta aberta (fora do Meu Locker, os envios vão para o início). */
  const here = place.section === 'drive' && !query.trim() ? place.folderId : null;
  /** Onde dá para soltar arquivos: no meu Locker (não na lixeira, nem no que é de outra conta). */
  const uploadsHere = place.section !== 'trash' && place.section !== 'shared' && place.section !== 'teams' && place.section !== 'keyboard' && place.section !== 'offline';

  const upload = async (picked: PickedFile[], target: string | null) => {
    if (!picked.length || demoBlocked()) return;
    if (!navigator.onLine) return notify(t('Sem internet. Envie quando a conexão voltar.'));
    const total = picked.reduce((sum, p) => sum + p.file.size, 0);
    if (usage?.limit && usage.used + total > usage.limit) {
      notify(t('Não cabe no seu Locker: libere espaço ou mude de plano para enviar mais arquivos.'));
      return;
    }
    const problem = await startUploads(picked, target, reload);
    if (problem) notify(problem);
  };

  const notify = useCallback((text: string, onUndo?: () => void) => {
    setToast(text);
    setUndo(() => onUndo ?? null);
  }, []);

  /** Demonstração: nada muda de verdade; mostra o convite para criar a conta. */
  function demoBlocked(): boolean {
    if (!PREVIEW) return false;
    notify(t('Esta é uma demonstração: nada é salvo. Baixe o app KEYCON e crie sua conta para usar o Locker de verdade.'));
    return true;
  }
  /** Abrir a escolha de arquivos (na demonstração, só o convite). */
  const pick = (input: React.RefObject<HTMLInputElement>) => {
    if (!demoBlocked()) input.current?.click();
  };

  // Locker de exemplo: os nomes acompanham o idioma da página
  const lang = useLanguage();
  useEffect(() => {
    if (PREVIEW) reload();
  }, [lang, reload]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast('');
      setUndo(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Soltar fora da área dos arquivos não abre o arquivo no navegador
  useEffect(() => {
    const stop = (e: DragEvent) => e.dataTransfer?.types.includes('Files') && e.preventDefault();
    addEventListener('dragover', stop);
    addEventListener('drop', stop);
    return () => {
      removeEventListener('dragover', stop);
      removeEventListener('drop', stop);
    };
  }, []);

  /** A pasta debaixo do mouse (cartão ou linha de pasta), senão a pasta aberta. */
  const targetAt = (el: EventTarget | null): string | null => {
    const card = el instanceof Element ? el.closest<HTMLElement>('[data-folder-id]') : null;
    return card?.dataset.folderId ?? here;
  };
  const dragDepth = useRef(0);
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('Files') || !uploadsHere) return;
      dragDepth.current++;
      setDropTarget(targetAt(e.target));
    },
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('Files') || !uploadsHere) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const target = targetAt(e.target);
      if (target !== dropTarget) setDropTarget(target);
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDropTarget(undefined);
    },
    onDrop: async (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('Files') || !uploadsHere) return;
      e.preventDefault();
      dragDepth.current = 0;
      const target = targetAt(e.target);
      setDropTarget(undefined);
      upload(await pickedFromDrop(e.dataTransfer), target);
    },
  };

  // ---------------------------------------------------------------------------
  // Seleção e ações (menu do botão direito, barra de seleção e atalhos)
  // ---------------------------------------------------------------------------
  const selection: Selection = useMemo(
    () => ({
      folders: pool.folders.filter(f => selected.has(f.id)),
      files: pool.files.filter(f => selected.has(f.id)),
    }),
    [pool, selected],
  );
  const count = selection.folders.length + selection.files.length;
  const single: Item | null =
    count !== 1 ? null : selection.folders[0] ? { kind: 'folder', folder: selection.folders[0] } : { kind: 'file', file: selection.files[0] };
  const allStarred = count > 0 && [...selection.folders, ...selection.files].every(i => i.starred);
  const inTrashView = place.section === 'trash' && !query.trim();

  // Some da seleção o que não está mais na tela (apagado, movido no app...)
  useEffect(() => {
    const visible = new Set(items.map(itemId));
    if ([...selected].some(id => !visible.has(id))) setSelected(new Set([...selected].filter(id => visible.has(id))));
  }, [items, selected]);

  /** Roda a ação, recarrega e mostra o erro, se houver. */
  const run = async (action: () => Promise<void>, done?: string, onUndo?: () => Promise<void>) => {
    if (demoBlocked()) return;
    if (!navigator.onLine) return notify(t('Sem internet. Tente de novo quando a conexão voltar.'));
    try {
      await action();
      await reload();
      if (done)
        notify(
          done,
          onUndo &&
            (() => {
              setToast('');
              setUndo(null);
              run(onUndo);
            }),
        );
    } catch (e) {
      notify(e instanceof Error ? e.message : t('Não deu certo. Tente de novo.'));
    }
  };

  const plural = (n: number, one: string, many: string) => (n === 1 ? t(one) : t(many, { n }));

  const trash = (sel: Selection) => {
    const n = sel.folders.length + sel.files.length;
    if (!n) return;
    setSelected(new Set());
    run(() => setTrashed(sel, true), plural(n, '1 item movido para a lixeira', '{n} itens movidos para a lixeira'), () => setTrashed(sel, false));
  };
  const restore = (sel: Selection) => {
    const n = sel.folders.length + sel.files.length;
    setSelected(new Set());
    run(() => setTrashed(sel, false), plural(n, '1 item restaurado', '{n} itens restaurados'));
  };
  const askDeleteForever = (sel: Selection) => {
    const n = sel.folders.length + sel.files.length;
    if (!n) return;
    setConfirming({
      title: t('Excluir para sempre?'),
      text: plural(n, 'O item será excluído para sempre. Não dá para desfazer.', 'Os {n} itens serão excluídos para sempre. Não dá para desfazer.'),
      confirm: t('Excluir para sempre'),
      run: async () => {
        await deleteForever(sel, data);
        setSelected(new Set());
        await reload();
        notify(plural(n, '1 item excluído para sempre', '{n} itens excluídos para sempre'));
      },
    });
  };
  const askEmptyTrash = () => {
    const sel: Selection = {
      folders: data.folders.filter(f => f.trashed_at),
      files: data.files.filter(f => f.trashed_at),
    };
    setConfirming({
      title: t('Esvaziar a lixeira?'),
      text: t('Tudo o que está na lixeira será excluído para sempre. Não dá para desfazer.'),
      confirm: t('Esvaziar a lixeira'),
      run: async () => {
        await deleteForever(sel, data);
        setSelected(new Set());
        await reload();
        notify(t('A lixeira foi esvaziada.'));
      },
    });
  };
  const star = (sel: Selection, on: boolean) =>
    run(() => setStarred(sel, on), on ? plural(sel.folders.length + sel.files.length, 'Estrela adicionada', 'Estrela adicionada em {n} itens') : t('Estrela removida'));
  const doMove = async (sel: Selection, target: string | null) => {
    // Para o Desfazer: cada item volta para onde estava
    const back = [
      ...sel.folders.map(f => ({ sel: { folders: [f], files: [] }, to: f.parent_id })),
      ...sel.files.map(f => ({ sel: { folders: [], files: [f] }, to: f.folder_id })),
    ];
    await moveTo(sel, target);
    setSelected(new Set());
    await reload();
    const n = sel.folders.length + sel.files.length;
    notify(
      n === 1 ? t('Movido para {folder}', { folder: locationOf(target) || t('Sem nome') }) : t('{n} itens movidos para {folder}', { n, folder: locationOf(target) || t('Sem nome') }),
      () => {
        setToast('');
        setUndo(null);
        run(async () => {
          for (const b of back) await moveTo(b.sel, b.to);
        });
      },
    );
  };
  const doDownload = (sel: Selection) =>
    run(async () => {
      await download(sel, pool, (done, total) => {
        if (total > 1 && done < total) setToast(t('Preparando o download… {done} de {total}', { done, total }));
      });
      setToast('');
    });
  /** Copia o link permanente; pasta privada: abre o Compartilhar para escolher quem vê. */
  const copyLink = async (item: Item) => {
    if (item.kind === 'folder' && (item.folder.visibility ?? 'private') === 'private') {
      setSharing({ kind: 'folder', folder: item.folder });
      notify(t('Esta pasta é privada. Escolha quem pode ver para copiar o link.'));
      return;
    }
    const link = item.kind === 'folder' ? lockerLink('d', item.folder.share_token) : lockerLink('f', item.file.share_token);
    try {
      await navigator.clipboard.writeText(link);
      notify(t('Link copiado'));
    } catch {
      setSharing(item.kind === 'folder' ? { kind: 'folder', folder: item.folder } : { kind: 'file', file: item.file });
    }
  };
  const allInKeyboard = count > 0 && [...selection.folders, ...selection.files].every(i => i.in_keyboard !== false);
  const keyboardToggle = (sel: Selection, shown: boolean) =>
    run(() => setInKeyboard(sel, shown), shown ? t('Agora aparece no teclado') : t('Saiu do teclado (continua no Locker)'));
  /** Arquivos da seleção, com o que está dentro das pastas escolhidas. */
  const selectionFiles = (sel: Selection) => {
    const inside = descendants(sel.folders, pool).files.filter(f => !f.trashed_at);
    return [...new Map([...sel.files, ...inside].map(f => [f.id, f])).values()];
  };
  const allOffline = count > 0 && selectionFiles(selection).every(f => offlineIds.has(f.id));
  const toggleOffline = async (sel: Selection, keep: boolean) => {
    if (demoBlocked()) return;
    const files = selectionFiles(sel);
    if (!files.length) return notify(t('Não há arquivos para guardar.'));
    if (!keep) {
      await removeOffline(userId, files.map(f => f.id));
      syncOfflineIds();
      return notify(t('Removido do uso sem internet'));
    }
    if (!navigator.onLine) return notify(t('Sem internet. Tente de novo quando a conexão voltar.'));
    try {
      const ok = await makeOffline(userId, files, (done, total) => total > 1 && done < total && setToast(t('Guardando para usar sem internet… {done} de {total}', { done, total })));
      syncOfflineIds();
      notify(ok === files.length ? plural(ok, 'Disponível sem internet', '{n} arquivos disponíveis sem internet') : t('{ok} de {total} guardados. Tente de novo os que faltaram.', { ok, total: files.length }));
    } catch {
      notify(t('Este navegador não guarda arquivos para usar sem internet.'));
    }
  };
  const offlineEntry = (): MenuEntry =>
    allOffline
      ? { icon: 'offline', label: t('Remover do uso sem internet'), onClick: () => toggleOffline(selection, false) }
      : { icon: 'offline', label: t('Disponibilizar sem internet'), onClick: () => toggleOffline(selection, true) };
  const doCopy = (files: LockerData['files']) => run(() => copyFiles(files), plural(files.length, 'Cópia criada', '{n} cópias criadas'));

  /** Itens do menu: do que está selecionado, ou do fundo da página. */
  const menuEntries = (item: Item | null): MenuEntry[] => {
    if (!item) {
      if (place.section !== 'drive' || query.trim()) return [];
      return [
        { icon: 'folder', label: t('Nova pasta'), onClick: () => setCreating(true) },
        'sep',
        { icon: 'arrowUp', label: t('Enviar arquivos'), onClick: () => pick(filesInput) },
        { icon: 'drive', label: t('Enviar pasta'), onClick: () => pick(folderInput) },
      ];
    }
    if (inTrashView) {
      return [
        { icon: 'restore', label: t('Restaurar'), onClick: () => restore(selection) },
        { icon: 'trash', label: t('Excluir para sempre'), danger: true, onClick: () => askDeleteForever(selection) },
      ];
    }
    const onlyFiles = !selection.folders.length && selection.files.length > 0;
    if (readOnly) {
      return [
        ...(single ? [{ icon: 'open' as const, label: single.kind === 'file' ? t('Visualizar') : t('Abrir'), hint: 'Enter', onClick: () => openItem(single) }] : []),
        { icon: 'download', label: t('Baixar'), onClick: () => doDownload(selection) },
        ...(single?.kind === 'file' ? [{ icon: 'link' as const, label: t('Copiar link'), onClick: () => copyLink(single) }] : []),
        offlineEntry(),
      ];
    }
    return [
      ...(single ? [{ icon: 'open' as const, label: single.kind === 'file' ? t('Visualizar') : t('Abrir'), hint: 'Enter', onClick: () => openItem(single) }] : []),
      ...(single
        ? [
            { icon: 'share' as const, label: t('Compartilhar'), onClick: () => setSharing(single.kind === 'folder' ? { kind: 'folder', folder: single.folder } : { kind: 'file', file: single.file }) },
            { icon: 'link' as const, label: t('Copiar link'), onClick: () => copyLink(single) },
          ]
        : []),
      { icon: 'download', label: t('Baixar'), onClick: () => doDownload(selection) },
      offlineEntry(),
      ...(single ? [{ icon: 'rename' as const, label: t('Renomear'), hint: 'F2', onClick: () => setRenaming(single) }] : []),
      ...(onlyFiles ? [{ icon: 'copy' as const, label: t('Fazer uma cópia'), onClick: () => doCopy(selection.files) }] : []),
      ...(single?.kind === 'file'
        ? [
            {
              icon: 'arrowUp' as const,
              label: t('Trocar por nova versão'),
              onClick: () => {
                if (!navigator.onLine) return notify(t('Sem internet. Envie quando a conexão voltar.'));
                versionTarget.current = single.file;
                pick(versionInput);
              },
            },
          ]
        : []),
      'sep',
      { icon: 'move', label: t('Mover para'), onClick: () => setMoving(selection) },
      allStarred
        ? { icon: 'star', label: t('Remover estrela'), filled: true, hint: 'S', onClick: () => star(selection, false) }
        : { icon: 'star', label: t('Adicionar estrela'), hint: 'S', onClick: () => star(selection, true) },
      allInKeyboard
        ? { icon: 'keyboardOff', label: t('Tirar do teclado'), onClick: () => keyboardToggle(selection, false) }
        : { icon: 'keyboard', label: t('Mostrar no teclado'), onClick: () => keyboardToggle(selection, true) },
      'sep',
      { icon: 'trash', label: t('Mover para a lixeira'), danger: true, hint: 'Del', onClick: () => trash(selection) },
    ];
  };

  // Atalhos do Drive: Del (lixeira), F2 ou N (renomear), S (estrela), Ctrl+A, Esc, / (busca)
  const busy = !!(menu || filterMenu || preview || sharing || renaming || moving || confirming || creating);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (busy || el.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInput.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(new Set(items.map(itemId)));
      } else if (e.key === 'Escape') {
        setSelected(new Set());
      } else if (!count || readOnly) {
        return;
      } else if (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        if (inTrashView) askDeleteForever(selection);
        else trash(selection);
      } else if ((e.key === 'F2' || e.key.toLowerCase() === 'n') && single && !inTrashView && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setRenaming(single);
      } else if (e.key.toLowerCase() === 's' && !inTrashView && !e.ctrlKey && !e.metaKey) {
        star(selection, !allStarred);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const title = query.trim()
    ? t('Resultados da busca')
    : place.section === 'drive' || (place.section === 'shared' && place.folderId)
      ? null
      : t(NAV.find(n => n.section === place.section)!.label);

  const email = session.user.email ?? '';

  return (
    <div className={`drive ${menuOpen ? 'menu-open' : ''}`}>
      {/* ------------------------------------------------------------ barra de cima */}
      <header className="topbar">
        <button className="icon-btn only-mobile" aria-label={t('Menu')} onClick={() => setMenuOpen(v => !v)}>
          <Icon name="menu" />
        </button>
        <a
          className="brand"
          href="/"
          onClick={e => {
            e.preventDefault();
            go({ section: 'drive', folderId: null });
          }}>
          <img src="/k-mark.png" alt="" width={32} height={32} />
          <span>Locker</span>
        </a>
        <label className="search">
          <Icon name="search" />
          <input ref={searchInput} type="search" placeholder={t('Pesquisar no Locker')} value={query} onChange={e => setQuery(e.target.value)} aria-label={t('Pesquisar no Locker')} />
          {query ? (
            <button className="icon-btn small" aria-label={t('Limpar busca')} onClick={() => setQuery('')}>
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </label>
        <div className="account">
          <button className="avatar" aria-label={t('Conta: {email}', { email })} aria-expanded={accountOpen} onClick={() => setAccountOpen(v => !v)}>
            {(email[0] || '?').toUpperCase()}
          </button>
          {accountOpen ? (
            <>
              <div className="backdrop" onClick={() => setAccountOpen(false)} />
              <div className="popover account-pop" role="menu">
                <div className="account-email">{email}</div>
                <div className="account-lang">
                  <LanguagePicker compact />
                </div>
                <button role="menuitem" className="menu-item" onClick={() => (DEMO ? leaveDemo() : clearOffline(userId).finally(() => supabase.auth.signOut()))}>
                  <Icon name="logout" size={18} />
                  {t('Sair')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </header>

      {/* ------------------------------------------------------------ menu lateral */}
      {menuOpen ? <div className="backdrop only-mobile" onClick={() => setMenuOpen(false)} /> : null}
      <nav className="sidebar" aria-label={t('Seções do Locker')}>
        <div className="new-wrap">
          <button className="new-btn" aria-haspopup="menu" aria-expanded={newOpen} onClick={() => setNewOpen(v => !v)}>
            <Icon name="plus" size={22} />
            {t('Novo')}
          </button>
          {newOpen ? (
            <>
              <div className="backdrop" onClick={() => setNewOpen(false)} />
              <div className="popover new-pop" role="menu">
                <button
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setNewOpen(false);
                    if (place.section !== 'drive') go({ section: 'drive', folderId: null });
                    setCreating(true);
                  }}>
                  <Icon name="folder" size={18} />
                  {t('Nova pasta')}
                </button>
                <div className="menu-sep" />
                <button
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setNewOpen(false);
                    pick(filesInput);
                  }}>
                  <Icon name="arrowUp" size={18} />
                  {t('Enviar arquivos')}
                </button>
                <button
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setNewOpen(false);
                    pick(folderInput);
                  }}>
                  <Icon name="drive" size={18} />
                  {t('Enviar pasta')}
                </button>
              </div>
            </>
          ) : null}
        </div>
        <ul className="nav">
          {NAV.map((n, i) => (
            <li key={n.section} className={i > 0 && NAV[i - 1].group !== n.group ? 'nav-gap' : undefined}>
              <button
                className={`nav-item ${place.section === n.section && !query ? 'active' : ''}`}
                aria-current={place.section === n.section && !query ? 'page' : undefined}
                onClick={() => go({ section: n.section, folderId: null })}>
                <Icon name={n.icon} size={20} />
                {t(n.label)}
              </button>
            </li>
          ))}
        </ul>
        <UsageMeter usage={usage} />
      </nav>

      {/* ------------------------------------------------------------ área dos arquivos */}
      <main className={`content ${dropTarget !== undefined ? 'dropping' : ''}`} aria-busy={!loaded} {...dropHandlers}>
        <div className={`content-head ${count ? 'has-selection' : ''}`}>
          {count ? (
            <div className="selection-bar" role="toolbar" aria-label={t('Ações da seleção')}>
              <button className="icon-btn small" aria-label={t('Limpar seleção')} title={t('Limpar seleção')} onClick={() => setSelected(new Set())}>
                <Icon name="close" size={18} />
              </button>
              <span className="selection-count">{count === 1 ? t('1 selecionado') : t('{n} selecionados', { n: count })}</span>
              {readOnly ? (
                <button className="icon-btn small" aria-label={t('Baixar')} title={t('Baixar')} onClick={() => doDownload(selection)}>
                  <Icon name="download" size={18} />
                </button>
              ) : inTrashView ? (
                <>
                  <button className="icon-btn small" aria-label={t('Restaurar')} title={t('Restaurar')} onClick={() => restore(selection)}>
                    <Icon name="restore" size={18} />
                  </button>
                  <button className="icon-btn small" aria-label={t('Excluir para sempre')} title={t('Excluir para sempre')} onClick={() => askDeleteForever(selection)}>
                    <Icon name="trash" size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button className="icon-btn small" aria-label={t('Baixar')} title={t('Baixar')} onClick={() => doDownload(selection)}>
                    <Icon name="download" size={18} />
                  </button>
                  <button className="icon-btn small" aria-label={t('Mover para')} title={t('Mover para')} onClick={() => setMoving(selection)}>
                    <Icon name="move" size={18} />
                  </button>
                  <button
                    className="icon-btn small"
                    aria-label={allStarred ? t('Remover estrela') : t('Adicionar estrela')}
                    title={allStarred ? t('Remover estrela') : t('Adicionar estrela')}
                    onClick={() => star(selection, !allStarred)}>
                    <Icon name="star" size={18} filled={allStarred} />
                  </button>
                  <button className="icon-btn small" aria-label={t('Mover para a lixeira')} title={t('Mover para a lixeira')} onClick={() => trash(selection)}>
                    <Icon name="trash" size={18} />
                  </button>
                  <button
                    className="icon-btn small"
                    aria-label={t('Mais ações')}
                    title={t('Mais ações')}
                    onClick={e => {
                      const r = e.currentTarget.getBoundingClientRect();
                      const first = single ?? (selection.folders[0] ? { kind: 'folder' as const, folder: selection.folders[0] } : { kind: 'file' as const, file: selection.files[0] });
                      setMenu({ x: r.left, y: r.bottom + 4, item: first });
                    }}>
                    <Icon name="more" size={18} />
                  </button>
                </>
              )}
            </div>
          ) : title ? (
            <h1 className="crumb-title">{title}</h1>
          ) : (
            <>
            {/* Celular: só a pasta aberta, com a seta para voltar (como no Drive) */}
            {(place.section === 'shared' ? sharedPath : path).length ? (
              <button
                className="icon-btn small only-mobile crumb-back"
                aria-label={t('Voltar')}
                onClick={() => {
                  const list = place.section === 'shared' ? sharedPath : path;
                  go({ section: place.section === 'shared' ? 'shared' : 'drive', folderId: list.length > 1 ? list[list.length - 2].id : null });
                }}>
                <Icon name="chevron" size={20} className="flip-x" />
              </button>
            ) : null}
            <ol className="crumbs" aria-label={t('Caminho')}>
              <li>
                <button
                  className={`crumb ${(place.section === 'shared' ? sharedPath : path).length ? '' : 'current'}`}
                  onClick={() => go({ section: place.section === 'shared' ? 'shared' : 'drive', folderId: null })}>
                  {place.section === 'shared' ? t('Compartilhados comigo') : t('Meu Locker')}
                </button>
              </li>
              {(place.section === 'shared' ? sharedPath : path).map((f, i, list) => (
                <li key={f.id}>
                  <Icon name="chevron" size={18} className="crumb-sep" />
                  <button
                    className={`crumb ${i === list.length - 1 ? 'current' : ''}`}
                    aria-current={i === list.length - 1 ? 'page' : undefined}
                    onClick={() => go({ section: place.section === 'shared' ? 'shared' : 'drive', folderId: f.id })}>
                    {f.name || t('Sem nome')}
                  </button>
                </li>
              ))}
            </ol>
            </>
          )}
          <div className="view-toggle" hidden={(place.section === 'keyboard' || place.section === 'teams') && !query.trim()} role="group" aria-label={t('Visualização')}>
            <button className={layout === 'list' ? 'on' : ''} aria-pressed={layout === 'list'} aria-label={t('Lista')} title={t('Lista')} onClick={() => chooseLayout('list')}>
              <Icon name="list" size={18} />
            </button>
            <button className={layout === 'grid' ? 'on' : ''} aria-pressed={layout === 'grid'} aria-label={t('Grade')} title={t('Grade')} onClick={() => chooseLayout('grid')}>
              <Icon name="grid" size={18} />
            </button>
          </div>
        </div>

        {(place.section !== 'keyboard' && place.section !== 'teams') || query.trim() ? (
        <div className="filters" role="group" aria-label={t('Filtros')}>
          <FilterChip
            label={typeFilter ? t(TYPE_FILTERS.find(f => f.id === typeFilter)!.label) : t('Tipo')}
            active={!!typeFilter}
            onOpen={(x, y) => setFilterMenu({ kind: 'type', x, y })}
            onClear={() => setTypeFilter(null)}
          />
          <FilterChip
            label={dateFilter ? t(DATE_FILTERS.find(f => f.id === dateFilter)!.label) : t('Modificado')}
            active={!!dateFilter}
            onOpen={(x, y) => setFilterMenu({ kind: 'date', x, y })}
            onClear={() => setDateFilter(null)}
          />
          {typeFilter || dateFilter ? (
            <button
              className="filters-clear"
              onClick={() => {
                setTypeFilter(null);
                setDateFilter(null);
              }}>
              {t('Limpar filtros')}
            </button>
          ) : null}
        </div>
        ) : null}

        {place.section === 'trash' && !query ? (
          <div className="notice trash-notice">
            <span>{t('Os itens ficam na lixeira por {days} dias e depois são excluídos para sempre.', { days: TRASH_DAYS })}</span>
            {items.length ? (
              <button className="btn ghost" onClick={askEmptyTrash}>
                {t('Esvaziar a lixeira')}
              </button>
            ) : null}
          </div>
        ) : null}

        {DEMO ? (
          <div className="notice demo-notice" role="status">
            <span>{t('Demonstração do Locker: os arquivos são de exemplo e nada é salvo.')}</span>
            <a className="btn primary" href="https://keyconapp.com" target="_blank" rel="noreferrer">
              {t('Conhecer o KEYCON')}
            </a>
          </div>
        ) : null}

        {!online || savedCopyAt ? (
          <div className="notice offline-notice" role="status">
            <Icon name="cloudOff" size={18} />
            <span>
              {savedCopyAt
                ? t('Sem internet. Você está vendo a cópia guardada neste aparelho ({when}). Os arquivos disponíveis sem internet abrem normalmente.', {
                    when: new Date(savedCopyAt).toLocaleString(),
                  })
                : t('Sem internet. Os arquivos disponíveis sem internet abrem normalmente; o resto volta com a conexão.')}
            </span>
          </div>
        ) : null}

        {loadError ? (
          <div className="empty">
            <Icon name="cloudOff" size={40} />
            <p>{t('Não foi possível carregar o Locker.')}</p>
            <button className="btn" onClick={reload}>
              {t('Tentar de novo')}
            </button>
          </div>
        ) : place.section === 'teams' && !query.trim() && loaded ? (
          <TeamsView userId={userId} userEmail={session.user.email ?? ''} onError={text => notify(text)} />
        ) : place.section === 'keyboard' && !query.trim() && loaded ? (
          <KeyboardView data={data} onChanged={reload} onError={text => notify(text)} />
        ) : !loaded ? (
          <div className="splash inline">
            <span className="spinner" />
          </div>
        ) : (
          <Browser
            items={items}
            layout={layout}
            sort={sort}
            onSort={setSort}
            mode={query.trim() ? 'search' : place.section}
            selected={selected}
            onSelect={setSelected}
            onMenu={(item, x, y) => (menuEntries(item).length ? setMenu({ x, y, item }) : undefined)}
            onOpen={openItem}
            locationOf={locationOfItem}
            sharedIds={sharedByMe}
            offlineIds={offlineIds}
            dropFolder={dropTarget}
            emptyText={
              typeFilter || dateFilter
                ? t('Nada encontrado com esses filtros.')
                : query.trim()
                ? t('Nada encontrado com "{q}".', { q: query.trim() })
                : place.section === 'starred'
                  ? t('Marque com estrela o que você mais usa para achar rápido aqui.')
                  : place.section === 'offline'
                    ? t('Marque arquivos ou pastas com "Disponibilizar sem internet" para abrir mesmo sem conexão.')
                    : place.section === 'shared'
                    ? t('O que outras pessoas compartilharem com você aparece aqui.')
                    : place.section === 'trash'
                    ? t('A lixeira está vazia.')
                    : place.section === 'recent'
                      ? t('Os arquivos que você enviar ou mudar aparecem aqui.')
                      : t('Arraste arquivos ou pastas para cá, ou use o botão Novo.')
            }
          />
        )}
      </main>

      {/* Aviso de soltar: para onde os arquivos vão */}
      {dropTarget !== undefined ? (
        <div className="drop-hint" role="status">
          <Icon name="arrowUp" size={20} />
          {t('Solte para enviar para {folder}', { folder: locationOf(dropTarget) || t('Sem nome') })}
        </div>
      ) : null}

      <input
        ref={filesInput}
        type="file"
        multiple
        hidden
        onChange={e => {
          upload(pickedFromInput(e.target.files), here);
          e.target.value = '';
        }}
      />
      <input
        ref={folderInput}
        type="file"
        hidden
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={e => {
          upload(pickedFromInput(e.target.files), here);
          e.target.value = '';
        }}
      />
      <input
        ref={versionInput}
        type="file"
        hidden
        onChange={async e => {
          const picked = e.target.files?.[0];
          const target = versionTarget.current;
          e.target.value = '';
          versionTarget.current = null;
          if (!picked || !target) return;
          const problem = await replaceUpload(target, picked, reload);
          if (problem) notify(problem);
        }}
      />
      <UploadPanel />
      {/* Celular: o "Novo" vira o botão + no canto, como no Drive */}
      {place.section === 'drive' && !query.trim() && !count ? (
        <button className="fab only-mobile" aria-label={t('Novo')} onClick={() => setMenu({ x: 0, y: 0, item: null })}>
          <Icon name="plus" size={26} />
        </button>
      ) : null}
      {toast ? (
        <div className="toast" role="alert">
          <span className="toast-text">{toast}</span>
          {undo ? (
            <button className="toast-action" onClick={undo}>
              {t('Desfazer')}
            </button>
          ) : null}
          <button className="icon-btn small on-dark" aria-label={t('Fechar')} onClick={() => {
              setToast('');
              setUndo(null);
            }}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}

      {filterMenu ? (
        <ContextMenu
          x={filterMenu.x}
          y={filterMenu.y}
          onClose={() => setFilterMenu(null)}
          entries={
            filterMenu.kind === 'type'
              ? TYPE_FILTERS.map(f => ({ icon: typeFilter === f.id ? 'check' : f.icon, label: t(f.label), onClick: () => setTypeFilter(typeFilter === f.id ? null : f.id) }))
              : DATE_FILTERS.map(f => ({ icon: dateFilter === f.id ? 'check' : 'clock', label: t(f.label), onClick: () => setDateFilter(dateFilter === f.id ? null : f.id) }))
          }
        />
      ) : null}
      {preview ? (
        <Preview
          files={sortItems(items, sort, query.trim() ? 'search' : place.section)
            .filter((i): i is Extract<Item, { kind: 'file' }> => i.kind === 'file')
            .map(i => i.file)}
          startId={preview}
          onClose={closePreview}
          onDownload={f => doDownload({ folders: [], files: [f] })}
          onCopyLink={f => copyLink({ kind: 'file', file: f })}
          onShare={f => setSharing({ kind: 'file', file: f })}
        />
      ) : null}
      {sharing ? (
        <ShareDialog
          target={sharing}
          userId={userId}
          userEmail={session.user.email ?? ''}
          onClose={() => {
            setSharing(null);
            reload();
          }}
          onChanged={reload}
          onCopied={text => notify(text)}
        />
      ) : null}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          entries={menuEntries(menu.item)}
          title={menu.item ? (count > 1 ? t('{n} itens', { n: count }) : itemName(menu.item)) : t('Novo')}
          onClose={() => setMenu(null)}
        />
      ) : null}
      {renaming ? (
        <NameDialog
          title={t('Renomear')}
          initial={itemName(renaming)}
          keepExtension={renaming.kind === 'file'}
          confirm={t('OK')}
          onClose={() => setRenaming(null)}
          onSubmit={async name => {
            await rename(renaming.kind, itemId(renaming), name);
            await reload();
          }}
        />
      ) : null}
      {moving ? (
        <MoveDialog
          sel={moving}
          data={data}
          start={moving.folders[0]?.parent_id ?? moving.files[0]?.folder_id ?? null}
          onClose={() => setMoving(null)}
          onMove={target => doMove(moving, target)}
        />
      ) : null}
      {confirming ? <ConfirmDialog title={confirming.title} text={confirming.text} confirm={confirming.confirm} onClose={() => setConfirming(null)} onConfirm={confirming.run} /> : null}
      {creating ? <NameDialog title={t('Nova pasta')} initial={t('Pasta sem nome')} confirm={t('Criar')} onClose={() => setCreating(false)} onSubmit={createFolder} /> : null}
    </div>
  );
}

/** Filtro em pílula: abre a lista de opções; escolhido, mostra a opção e o X para tirar. */
function FilterChip({ label, active, onOpen, onClear }: { label: string; active: boolean; onOpen: (x: number, y: number) => void; onClear: () => void }) {
  return (
    <span className={`chip ${active ? 'on' : ''}`}>
      <button
        className="chip-main"
        aria-haspopup="menu"
        onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          onOpen(r.left, r.bottom + 4);
        }}>
        {active ? <Icon name="check" size={16} /> : null}
        {label}
        {active ? null : <Icon name="down" size={16} />}
      </button>
      {active ? (
        <button className="chip-x" aria-label={t('Tirar o filtro {name}', { name: label })} onClick={onClear}>
          <Icon name="close" size={14} />
        </button>
      ) : null}
    </span>
  );
}
