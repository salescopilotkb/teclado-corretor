/** Confirmação antes do que não tem volta (excluir para sempre, esvaziar a lixeira). */
import React, { useEffect, useState } from 'react';
import { t } from '../../src/i18n';

export function ConfirmDialog({
  title,
  text,
  confirm,
  onClose,
  onConfirm,
}: {
  title: string;
  text: string;
  confirm: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  const go = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Não deu certo. Tente de novo.'));
      setBusy(false);
    }
  };

  return (
    <div className="dialog-layer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-text" className="muted">
          {text}
        </p>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" autoFocus onClick={onClose}>
            {t('Cancelar')}
          </button>
          <button className="btn danger" disabled={busy} onClick={go}>
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
