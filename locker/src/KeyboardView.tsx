/**
 * "Teclado": como o Locker aparece no teclado do celular, e em que ordem.
 * Arraste as linhas para mudar a ordem (ou use as setas), o X tira do teclado e
 * "Mostrar no teclado" traz de volta. O app e o teclado recebem na hora.
 * Clique numa pasta para organizar o que tem dentro.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { t } from '../../src/i18n';
import { fileType, fileUrlNow } from './data';
import type { LockerData, LockerFile, LockerFolder } from './data';
import { Icon, TypeIcon } from './icons';
import { keyboardLevel, saveOrder, setInKeyboard } from './keyboard';
import { PREVIEW } from './demo';

type Row = { kind: 'folder'; item: LockerFolder } | { kind: 'file'; item: LockerFile };

export function KeyboardView({ data, onChanged, onError }: { data: LockerData; onChanged: () => Promise<void>; onError: (text: string) => void }) {
  const [level, setLevel] = useState<string | null>(null);
  const byId = useMemo(() => new Map(data.folders.map(f => [f.id, f])), [data.folders]);
  const current = level ? byId.get(level) : undefined;
  // A pasta aberta saiu do teclado ou foi apagada: volta ao início
  useEffect(() => {
    if (level && (!current || current.trashed_at || current.in_keyboard === false)) setLevel(null);
  }, [level, current]);

  const view = keyboardLevel(data, current ? level : null);
  // Ordem enquanto arrasta (antes de gravar)
  const [draft, setDraft] = useState<{ kind: 'folder' | 'file'; ids: string[] } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const ordered = <T extends { id: string }>(kind: 'folder' | 'file', list: T[]): T[] => {
    if (draft?.kind !== kind) return list;
    const map = new Map(list.map(i => [i.id, i]));
    return draft.ids.map(id => map.get(id)).filter((i): i is T => !!i);
  };
  const folders = ordered('folder', view.folders);
  const files = ordered('file', view.files);

  /** Caminho até a pasta aberta (para o "voltar" e o título). */
  const path: LockerFolder[] = [];
  for (let id = current ? level : null, guard = 0; id && guard < 64; guard++) {
    const f = byId.get(id);
    if (!f) break;
    path.unshift(f);
    id = f.parent_id;
  }

  const demoText = () => t('Esta é uma demonstração: nada é salvo. Baixe o app KEYCON e crie sua conta para usar o Locker de verdade.');

  const persist = async (kind: 'folder' | 'file', list: Array<LockerFolder | LockerFile>) => {
    if (PREVIEW) {
      setDraft(null);
      return onError(demoText());
    }
    try {
      await saveOrder(kind === 'folder' ? 'locker_folders' : 'locker_files', list);
      await onChanged();
    } catch {
      onError(t('Não foi possível salvar a ordem. Confira a internet e tente de novo.'));
    } finally {
      setDraft(null);
    }
  };

  const move = (kind: 'folder' | 'file', list: Array<LockerFolder | LockerFile>, index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    [next[index], next[to]] = [next[to], next[index]];
    setDraft({ kind, ids: next.map(i => i.id) });
    persist(kind, next);
  };

  const hide = async (row: Row) => {
    if (PREVIEW) return onError(demoText());
    try {
      await setInKeyboard(row.kind === 'folder' ? { folders: [row.item], files: [] } : { folders: [], files: [row.item] }, false);
      await onChanged();
    } catch {
      onError(t('Não foi possível salvar. Confira a internet e tente de novo.'));
    }
  };
  const show = async (row: Row) => {
    if (PREVIEW) return onError(demoText());
    try {
      await setInKeyboard(row.kind === 'folder' ? { folders: [row.item], files: [] } : { folders: [], files: [row.item] }, true);
      await onChanged();
    } catch {
      onError(t('Não foi possível salvar. Confira a internet e tente de novo.'));
    }
  };

  /** Arrastar para reordenar (só dentro do mesmo grupo: pastas com pastas, arquivos com arquivos). */
  const dragProps = (kind: 'folder' | 'file', list: Array<LockerFolder | LockerFile>, id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      setDragging(id);
      setDraft({ kind, ids: list.map(i => i.id) });
    },
    onDragOver: (e: React.DragEvent) => {
      if (!dragging || draft?.kind !== kind || dragging === id) return;
      e.preventDefault();
      const ids = draft.ids.filter(x => x !== dragging);
      const box = e.currentTarget.getBoundingClientRect();
      const after = e.clientY > box.top + box.height / 2;
      const at = ids.indexOf(id) + (after ? 1 : 0);
      ids.splice(at, 0, dragging);
      if (ids.join() !== draft.ids.join()) setDraft({ kind, ids });
    },
    onDrop: (e: React.DragEvent) => e.preventDefault(),
    onDragEnd: () => {
      setDragging(null);
      if (!draft || draft.kind !== kind) return;
      const map = new Map(list.map(i => [i.id, i]));
      const next = draft.ids.map(x => map.get(x)).filter((i): i is LockerFolder | LockerFile => !!i);
      if (next.map(i => i.id).join() === list.map(i => i.id).join()) setDraft(null);
      else persist(kind, next);
    },
  });

  const hiddenCount = view.hiddenFolders.length + view.hiddenFiles.length;

  return (
    <div className="kb-view">
      <p className="muted kb-intro">
        {t('É assim que o Locker aparece no teclado do celular. Arraste para mudar a ordem; o X tira do teclado (continua no Locker).')}
      </p>
      <div className="kb-frame" aria-label={t('Prévia do teclado')}>
        <div className="kb-menu" aria-hidden="true">
          {['ABC', 'Locker', t('Produtos'), t('Atalhos')].map((label, i) => (
            <span key={label} className={`kb-menu-btn ${i === 1 ? 'on' : ''}`}>
              {label}
            </span>
          ))}
        </div>
        <div className="kb-bar">
          {path.length ? (
            <button className="kb-back" onClick={() => setLevel(path.length > 1 ? path[path.length - 2].id : null)}>
              <Icon name="chevron" size={18} className="flip-x" />
              <span className="name">{path[path.length - 1].name || t('Sem nome')}</span>
            </button>
          ) : (
            <span className="kb-title">Locker</span>
          )}
        </div>
        {!folders.length && !files.length ? <p className="kb-empty">{t('Nada aqui no teclado.')}</p> : null}
        <ul className="kb-list">
          {folders.map((f, i) => (
            <KbRow
              key={f.id}
              row={{ kind: 'folder', item: f }}
              dragging={dragging === f.id}
              drag={dragProps('folder', folders, f.id)}
              canUp={i > 0}
              canDown={i < folders.length - 1}
              onOpen={() => setLevel(f.id)}
              onUp={() => move('folder', folders, i, -1)}
              onDown={() => move('folder', folders, i, 1)}
              onHide={() => hide({ kind: 'folder', item: f })}
            />
          ))}
          {files.map((f, i) => (
            <KbRow
              key={f.id}
              row={{ kind: 'file', item: f }}
              dragging={dragging === f.id}
              drag={dragProps('file', files, f.id)}
              canUp={i > 0}
              canDown={i < files.length - 1}
              onUp={() => move('file', files, i, -1)}
              onDown={() => move('file', files, i, 1)}
              onHide={() => hide({ kind: 'file', item: f })}
            />
          ))}
        </ul>
      </div>

      {hiddenCount ? (
        <section className="kb-hidden">
          <h2 className="group-title">{t('Fora do teclado')}</h2>
          <p className="muted">{t('Continuam no Locker do app e do navegador, mas não aparecem no teclado.')}</p>
          <ul>
            {[...view.hiddenFolders.map(item => ({ kind: 'folder' as const, item })), ...view.hiddenFiles.map(item => ({ kind: 'file' as const, item }))].map(row => (
              <li key={row.item.id} className="kb-hidden-row">
                <TypeIcon type={row.kind === 'folder' ? 'folder' : fileType(row.item)} />
                <span className="name">{row.item.name || t('Sem nome')}</span>
                <button className="btn small-btn" onClick={() => show(row)}>
                  <Icon name="plus" size={16} />
                  {t('Mostrar no teclado')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function KbRow({
  row,
  dragging,
  drag,
  canUp,
  canDown,
  onOpen,
  onUp,
  onDown,
  onHide,
}: {
  row: Row;
  dragging: boolean;
  drag: React.HTMLAttributes<HTMLLIElement> & { draggable: boolean };
  canUp: boolean;
  canDown: boolean;
  onOpen?: () => void;
  onUp: () => void;
  onDown: () => void;
  onHide: () => void;
}) {
  const name = row.item.name || t('Sem nome');
  const type = row.kind === 'folder' ? 'folder' : fileType(row.item);
  const thumb = row.kind === 'file' && type === 'image' ? fileUrlNow(row.item) : '';
  return (
    <li className={`kb-row ${dragging ? 'dragging' : ''}`} {...drag}>
      <span className="kb-grip" aria-hidden="true">
        ⋮⋮
      </span>
      <button className="kb-main" disabled={!onOpen} onClick={onOpen} tabIndex={onOpen ? 0 : -1}>
        {thumb ? <img src={thumb} alt="" className="kb-thumb" draggable={false} /> : <TypeIcon type={type} size={20} />}
        <span className="name">{name}</span>
        {onOpen ? <Icon name="chevron" size={16} className="kb-chev" /> : null}
      </button>
      <button className="kb-btn" aria-label={t('Subir {name}', { name })} disabled={!canUp} onClick={onUp}>
        <Icon name="arrowUp" size={16} />
      </button>
      <button className="kb-btn" aria-label={t('Descer {name}', { name })} disabled={!canDown} onClick={onDown}>
        <Icon name="arrowDown" size={16} />
      </button>
      <button className="kb-btn" aria-label={t('Tirar {name} do teclado', { name })} title={t('Tirar do teclado')} onClick={onHide}>
        <Icon name="close" size={16} />
      </button>
    </li>
  );
}
