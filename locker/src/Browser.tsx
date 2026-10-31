/**
 * A área dos arquivos: grade (pastas em cima, arquivos com miniatura embaixo)
 * ou lista (Nome, Modificado, Tamanho), com ordenação por nome, data ou tamanho.
 *
 * Como no Drive: um clique seleciona, dois cliques abrem; Ctrl/⌘ soma à seleção e
 * Shift seleciona o intervalo. O círculo de marcar e o ⋮ servem também ao toque
 * (no celular, um toque abre; com algo marcado, um toque marca). Botão direito
 * abre o menu de ações.
 */
import React, { useMemo, useRef } from 'react';
import { formatBytes } from '../../src/files/limits';
import { getLanguage, t } from '../../src/i18n';
import { fileType, fileUrlNow } from './data';
import type { LockerFile, LockerFolder } from './data';
import type { Section } from './Drive';
import { Icon, TypeIcon } from './icons';

export type Item = { kind: 'folder'; folder: LockerFolder } | { kind: 'file'; file: LockerFile };

/** Marca discreta de "fora do teclado" (o item continua no Locker). */
function OffKeyboard({ item }: { item: Item }) {
  if ((item.kind === 'folder' ? item.folder.in_keyboard : item.file.in_keyboard) !== false) return null;
  return (
    <span className="off-kb" title={t('Fora do teclado')} aria-label={t('Fora do teclado')}>
      <Icon name="keyboardOff" size={14} />
    </span>
  );
}
export type Layout = 'grid' | 'list';
export type SortBy = 'name' | 'updated' | 'size';
export type Sort = { by: SortBy; dir: 'asc' | 'desc' };

type Mode = Section | 'search';

export const itemId = (i: Item) => (i.kind === 'folder' ? i.folder.id : i.file.id);
export const itemName = (i: Item) => (i.kind === 'folder' ? i.folder.name : i.file.name) || t('Sem nome');
const itemDate = (i: Item, mode: Mode) => {
  const row = i.kind === 'folder' ? i.folder : i.file;
  return mode === 'trash' ? row.trashed_at ?? row.updated_at : row.updated_at;
};
const itemSize = (i: Item) => (i.kind === 'file' ? Number(i.file.size_bytes) || 0 : 0);

/** Toque (celular, tablet): um toque já abre. */
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function sortItems(items: Item[], sort: Sort, mode: Mode): Item[] {
  // Recentes: sempre do mais novo para o mais antigo (como no Drive)
  const s: Sort = mode === 'recent' ? { by: 'updated', dir: 'desc' } : sort;
  const sign = s.dir === 'asc' ? 1 : -1;
  const byName = (a: Item, b: Item) => itemName(a).localeCompare(itemName(b), undefined, { numeric: true, sensitivity: 'base' });
  const cmp = (a: Item, b: Item) => {
    if (s.by === 'updated') return sign * (Date.parse(itemDate(a, mode)) - Date.parse(itemDate(b, mode))) || byName(a, b);
    if (s.by === 'size') return sign * (itemSize(a) - itemSize(b)) || byName(a, b);
    return sign * byName(a, b);
  };
  // Pastas sempre antes dos arquivos
  return [...items].sort((a, b) => (a.kind === b.kind ? cmp(a, b) : a.kind === 'folder' ? -1 : 1));
}

/** "Hoje", "Ontem", "Últimos 7 dias"... para agrupar os Recentes. */
function dayGroup(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diff <= 0) return t('Hoje');
  if (diff === 1) return t('Ontem');
  if (diff < 7) return t('Últimos 7 dias');
  if (diff < 30) return t('Últimos 30 dias');
  return t('Mais antigos');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const lang = getLanguage();
  const locale = lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es' : 'en-US';
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function Browser({
  items,
  layout,
  sort,
  onSort,
  mode,
  selected,
  onSelect,
  onOpen,
  locationOf,
  emptyText,
  dropFolder,
  onMenu,
  sharedIds,
  offlineIds,
}: {
  items: Item[];
  layout: Layout;
  sort: Sort;
  onSort: (s: Sort) => void;
  mode: Mode;
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onOpen: (item: Item) => void;
  /** Menu de ações: de um item (já selecionado) ou do fundo (item null). */
  onMenu: (item: Item | null, x: number, y: number) => void;
  /** Coluna "Local" (ou "Compartilhado por" em Compartilhados comigo). */
  locationOf: (item: Item) => string;
  /** Itens meus que estão compartilhados com pessoas ou equipes (ícone de pessoas). */
  sharedIds?: Set<string>;
  /** Arquivos guardados neste aparelho para usar sem internet. */
  offlineIds?: Set<string>;
  emptyText: string;
  /** Pasta onde os arquivos arrastados vão cair (destaca o cartão). */
  dropFolder?: string | null;
}) {
  /** De onde começa a seleção com Shift. */
  const anchor = useRef<string | null>(null);
  /** Toque: segurar marca o item (como no Drive do celular). */
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  const sorted = useMemo(() => {
    const list = sortItems(items, sort, mode);
    return mode === 'recent' ? list.slice(0, 100) : list;
  }, [items, sort, mode]);

  const background = (e: React.MouseEvent) => {
    if (mode !== 'drive') return;
    e.preventDefault();
    onSelect(new Set());
    onMenu(null, e.clientX, e.clientY);
  };

  if (!sorted.length) {
    return (
      <div className="empty" onClick={() => onSelect(new Set())} onContextMenu={background}>
        <Icon name={mode === 'trash' ? 'trash' : mode === 'starred' ? 'star' : mode === 'search' ? 'search' : mode === 'shared' ? 'team' : 'drive'} size={44} />
        <p>{emptyText}</p>
      </div>
    );
  }

  const lang = getLanguage();
  const order = sorted.map(itemId);
  const toggle = (item: Item) => {
    const id = itemId(item);
    anchor.current = id;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect(next);
  };
  const choose = (item: Item, e: React.MouseEvent) => {
    const id = itemId(item);
    const add = e.ctrlKey || e.metaKey;
    if (e.shiftKey && anchor.current && order.includes(anchor.current)) {
      const [a, b] = [order.indexOf(anchor.current), order.indexOf(id)].sort((x, y) => x - y);
      const range = order.slice(a, b + 1);
      onSelect(new Set(add ? [...selected, ...range] : range));
      return;
    }
    if (add) return toggle(item);
    anchor.current = id;
    onSelect(new Set([id]));
  };
  const common = (item: Item) => {
    const id = itemId(item);
    return {
      tabIndex: 0,
      'data-folder-id': item.kind === 'folder' ? item.folder.id : undefined,
      'aria-selected': selected.has(id),
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        longPressed.current = false;
        const timer = setTimeout(() => {
          longPressed.current = true;
          press.current = null;
          toggle(item);
          navigator.vibrate?.(10);
        }, 450);
        press.current = { timer, x: e.clientX, y: e.clientY };
      },
      onPointerMove: (e: React.PointerEvent) => {
        // Rolou a tela: não é segurar
        if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) {
          clearTimeout(press.current.timer);
          press.current = null;
        }
      },
      onPointerUp: () => {
        if (press.current) clearTimeout(press.current.timer);
        press.current = null;
      },
      onPointerCancel: () => {
        if (press.current) clearTimeout(press.current.timer);
        press.current = null;
      },
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        // O toque longo já marcou: o clique que vem junto não abre
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        if (coarse) return selected.size ? toggle(item) : onOpen(item);
        choose(item, e);
      },
      onDoubleClick: () => !coarse && onOpen(item),
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // No toque, segurar marca (o menu fica no ⋮)
        if (coarse) return;
        if (!selected.has(id)) {
          anchor.current = id;
          onSelect(new Set([id]));
        }
        onMenu(item, e.clientX, e.clientY);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter') onOpen(item);
        if (e.key === ' ') {
          e.preventDefault();
          toggle(item);
        }
      },
    };
  };
  /** Círculo de marcar (aparece ao passar o mouse ou quando já há algo marcado). */
  const check = (item: Item) => (
    <button
      className="check"
      role="checkbox"
      tabIndex={-1}
      aria-checked={selected.has(itemId(item))}
      aria-label={t('Selecionar {name}', { name: itemName(item) })}
      onClick={e => {
        e.stopPropagation();
        toggle(item);
      }}
      onDoubleClick={e => e.stopPropagation()}>
      <Icon name="check" size={14} />
    </button>
  );
  /** ⋮: o mesmo menu do botão direito. */
  const more = (item: Item) => (
    <button
      className="more-btn"
      aria-label={t('Mais ações para {name}', { name: itemName(item) })}
      onClick={e => {
        e.stopPropagation();
        const id = itemId(item);
        if (!selected.has(id)) {
          anchor.current = id;
          onSelect(new Set([id]));
        }
        const r = e.currentTarget.getBoundingClientRect();
        onMenu(item, r.left, r.bottom + 4);
      }}
      onDoubleClick={e => e.stopPropagation()}>
      <Icon name="more" size={20} />
    </button>
  );
  const selecting = selected.size > 0 ? 'selecting' : '';
  const showLocation = mode === 'recent' || mode === 'starred' || mode === 'search' || mode === 'trash' || mode === 'shared';
  const sharedBadge = (item: Item) => (
    <>
      {offlineIds?.has(itemId(item)) ? (
        <span className="off-kb" title={t('Disponível sem internet')} aria-label={t('Disponível sem internet')}>
          <Icon name="offline" size={14} />
        </span>
      ) : null}
      {sharedIds?.has(itemId(item)) ? (
      <span className="off-kb" title={t('Compartilhado')} aria-label={t('Compartilhado')}>
        <Icon name="team" size={14} />
      </span>
    ) : null}
    </>
  );

  // ---------------------------------------------------------------------------- lista
  if (layout === 'list') {
    const header = (by: SortBy, label: string, className: string) => {
      const on = sort.by === by && mode !== 'recent';
      return (
        <div className={`col ${className}`} role="columnheader" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
          <button className={`col-btn ${on ? 'on' : ''}`} disabled={mode === 'recent'} onClick={() => onSort({ by, dir: on && sort.dir === 'asc' ? 'desc' : by === 'name' ? 'asc' : on ? 'asc' : 'desc' })}>
            {label}
            {on ? <Icon name={sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={14} /> : null}
          </button>
        </div>
      );
    };
    let lastGroup = '';
    return (
      <div className={`list ${selecting}`} role="grid" aria-multiselectable="true" aria-label={t('Arquivos')} onClick={() => onSelect(new Set())} onContextMenu={background}>
        <div className="list-row list-head" role="row">
          {header('name', t('Nome'), 'c-name')}
          {showLocation ? (
            <div className="col c-loc" role="columnheader">
              {mode === 'shared' ? t('Compartilhado por') : t('Local')}
            </div>
          ) : null}
          {header('updated', mode === 'trash' ? t('Na lixeira desde') : t('Modificado'), 'c-date')}
          {header('size', t('Tamanho'), 'c-size')}
          <div className="col c-more" role="columnheader">
            <span className="sr-only">{t('Ações')}</span>
          </div>
        </div>
        {sorted.map(item => {
          const id = itemId(item);
          const group = mode === 'recent' ? dayGroup(itemDate(item, mode)) : '';
          const showGroup = group && group !== lastGroup;
          lastGroup = group;
          return (
            <React.Fragment key={id}>
              {showGroup ? <div className="group-title">{group}</div> : null}
              <div className={`list-row item ${selected.has(id) ? 'selected' : ''} ${dropFolder === id ? 'drop-into' : ''}`} role="row" {...common(item)}>
                <div className="col c-name" role="gridcell">
                  <span className="icon-slot">
                    <TypeIcon type={item.kind === 'folder' ? 'folder' : fileType(item.file)} />
                    {check(item)}
                  </span>
                  <span className="name">{itemName(item)}</span>
                  {(item.kind === 'folder' ? item.folder.starred : item.file.starred) ? <Icon name="star" size={14} filled className="star-badge" /> : null}
                  {sharedBadge(item)}
                  <OffKeyboard item={item} />
                </div>
                {showLocation ? (
                  <div className="col c-loc muted" role="gridcell">
                    {locationOf(item)}
                  </div>
                ) : null}
                <div className="col c-date muted" role="gridcell">
                  {formatDate(itemDate(item, mode))}
                </div>
                <div className="col c-size muted" role="gridcell">
                  {item.kind === 'file' ? formatBytes(itemSize(item), lang) : '—'}
                </div>
                <div className="col c-more" role="gridcell">
                  {more(item)}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // ---------------------------------------------------------------------------- grade
  const folders = sorted.filter(i => i.kind === 'folder');
  const files = sorted.filter(i => i.kind === 'file');
  const sortLabel: Record<SortBy, string> = { name: t('Nome'), updated: t('Modificado'), size: t('Tamanho') };
  /** Ordenar (como no Drive: ao lado do primeiro título da grade). */
  const sortBar =
    mode === 'recent' ? null : (
      <div className="sort-bar">
        <label className="sort-select">
          <span className="sr-only">{t('Ordenar por')}</span>
          <select value={sort.by} onChange={e => onSort({ by: e.target.value as SortBy, dir: e.target.value === 'name' ? 'asc' : 'desc' })}>
            {(Object.keys(sortLabel) as SortBy[]).map(by => (
              <option key={by} value={by}>
                {sortLabel[by]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-btn small"
          aria-label={sort.dir === 'asc' ? t('Crescente') : t('Decrescente')}
          title={sort.dir === 'asc' ? t('Crescente') : t('Decrescente')}
          onClick={e => {
            e.stopPropagation();
            onSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
          }}>
          <Icon name={sort.dir === 'asc' ? 'arrowUp' : 'arrowDown'} size={16} />
        </button>
      </div>
    );
  /** Título do grupo; o primeiro leva o ordenar ao lado. */
  const head = (title: string, first: boolean) => (
    <div className="grid-head">
      <h2 className="group-title">{title}</h2>
      {first ? sortBar : null}
    </div>
  );
  return (
    <div className={`grid-wrap ${selecting}`} onClick={() => onSelect(new Set())} onContextMenu={background}>
      {folders.length ? (
        <section aria-label={t('Pastas')}>
          {head(t('Pastas'), true)}
          <div className="folder-grid">
            {folders.map(item => {
              const id = itemId(item);
              return (
                <div key={id} className={`folder-card item ${selected.has(id) ? 'selected' : ''} ${dropFolder === id ? 'drop-into' : ''}`} role="button" {...common(item)}>
                  <span className="icon-slot">
                    <TypeIcon type="folder" size={22} />
                    {check(item)}
                  </span>
                  <span className="name">{itemName(item)}</span>
                  {item.kind === 'folder' && item.folder.starred ? <Icon name="star" size={14} filled className="star-badge" /> : null}
                  {sharedBadge(item)}
                  <OffKeyboard item={item} />
                  {more(item)}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      {files.length ? (
        <section aria-label={t('Arquivos')}>
          {head(t('Arquivos'), !folders.length)}
          <div className="file-grid">
            {files.map(item => {
              if (item.kind !== 'file') return null;
              const id = itemId(item);
              const type = fileType(item.file);
              return (
                <div key={id} className={`file-card item ${selected.has(id) ? 'selected' : ''}`} role="button" {...common(item)}>
                  <div className="file-card-head">
                    <span className="icon-slot">
                      <TypeIcon type={type} size={18} />
                      {check(item)}
                    </span>
                    <span className="name">{itemName(item)}</span>
                    {item.file.starred ? <Icon name="star" size={14} filled className="star-badge" /> : null}
                    {sharedBadge(item)}
                    <OffKeyboard item={item} />
                    {more(item)}
                  </div>
                  <Thumb file={item.file} type={type} />
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Miniatura: a própria foto, o primeiro quadro do vídeo ou o ícone grande do tipo. */
function Thumb({ file, type }: { file: LockerFile; type: ReturnType<typeof fileType> }) {
  const url = fileUrlNow(file);
  if (type === 'image' && url) return <img className="thumb" src={url} alt="" loading="lazy" draggable={false} />;
  if (type === 'video' && url) return <video className="thumb" src={`${url}#t=0.5`} preload="metadata" muted playsInline />;
  return (
    <div className="thumb thumb-icon">
      <TypeIcon type={type} size={48} />
    </div>
  );
}
