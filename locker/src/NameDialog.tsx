/** Janela para dar nome (nova pasta, renomear). */
import React, { useEffect, useRef, useState } from 'react';
import { t } from '../../src/i18n';

export function NameDialog({
  title,
  initial,
  confirm,
  keepExtension,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: string;
  confirm: string;
  /** Arquivo: já vem marcado só o nome, sem a extensão (como no Drive). */
  keepExtension?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dot = keepExtension ? initial.lastIndexOf('.') : -1;
    if (dot > 0) input.current?.setSelectionRange(0, dot);
    else input.current?.select();
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await onSubmit(clean);
      onClose();
    } catch {
      setError(t('Não foi possível salvar. Confira a internet e tente de novo.'));
      setBusy(false);
    }
  };

  return (
    <div className="dialog-layer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="name-dialog-title" onSubmit={submit}>
        <h2 id="name-dialog-title">{title}</h2>
        <input ref={input} value={name} maxLength={120} onChange={e => setName(e.target.value)} aria-label={t('Nome')} />
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('Cancelar')}
          </button>
          <button className="btn primary" disabled={busy || !name.trim()}>
            {confirm}
          </button>
        </div>
      </form>
    </div>
  );
}
