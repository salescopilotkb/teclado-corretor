/**
 * "Mover para": navega pelas pastas (como no Drive) e move para a pasta aberta.
 * A própria pasta que está sendo movida (e o que tem dentro) não aparece como destino.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { t } from '../../src/i18n';
import { invalidMoveTarget } from './actions';
import type { Selection } from './actions';
import type { LockerData } from './data';
import { Icon, TypeIcon } from './icons';

export function MoveDialog({
  sel,
  data,
  start,
  onClose,
  onMove,
}: {
  sel: Selection;
  data: LockerData;
  start: string | null;
  onClose: () => void;
  onMove: (target: string | null) => Promise<void>;
}) {
  const [at, setAt] = useState<string | null>(start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const byId = useMemo(() => new Map(data.folders.map(f => [f.id, f])), [data.folders]);
  const current = at ? byId.get(at) : undefined;
  const moving = new Set(sel.folders.map(f => f.id));
  const children = data.folders
    .filter(f => f.parent_id === at && !f.trashed_at && !moving.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const count = sel.folders.length + sel.files.length;
  const single = count === 1 ? (sel.folders[0]?.name ?? sel.files[0]?.name) : '';
  // Já está aqui: nada a fazer
  const alreadyHere = [...sel.folders.map(f => f.parent_id), ...sel.files.map(f => f.folder_id)].every(p => p === at);
  const blocked = invalidMoveTarget(sel, at, data);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    try {
      await onMove(at);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Não foi possível mover.'));
      setBusy(false);
    }
  };

  return (
    <div className="dialog-layer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-title">
        <h2 id="move-title">{single ? t('Mover "{name}"', { name: single }) : t('Mover {n} itens', { n: count })}</h2>
        <div className="move-head">
          {at ? (
            <button className="icon-btn small" aria-label={t('Voltar')} onClick={() => setAt(current?.parent_id ?? null)}>
              <Icon name="chevron" size={18} className="flip-x" />
            </button>
          ) : null}
          <span className="move-where">{current ? current.name || t('Sem nome') : t('Meu Locker')}</span>
        </div>
        <ul className="move-list">
          {children.length ? (
            children.map(f => (
              <li key={f.id}>
                <button className="move-row" onClick={() => setAt(f.id)}>
                  <TypeIcon type="folder" />
                  <span className="name">{f.name || t('Sem nome')}</span>
                  <Icon name="chevron" size={18} className="muted" />
                </button>
              </li>
            ))
          ) : (
            <li className="move-empty muted">{t('Nenhuma pasta aqui dentro.')}</li>
          )}
        </ul>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('Cancelar')}
          </button>
          <button className="btn primary" disabled={busy || alreadyHere || blocked} onClick={submit}>
            {t('Mover aqui')}
          </button>
        </div>
      </div>
    </div>
  );
}
