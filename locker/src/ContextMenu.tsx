/** Menu do botão direito (e do ⋮), como o do Drive: abre onde o mouse está, sempre dentro da tela. */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';

export type MenuEntry = { icon: IconName; label: string; hint?: string; danger?: boolean; disabled?: boolean; filled?: boolean; onClick: () => void } | 'sep';

/** Tela estreita (celular): o menu sobe de baixo, com o nome do item em cima. */
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;

export function ContextMenu({ x, y, entries, onClose, title }: { x: number; y: number; entries: MenuEntry[]; onClose: () => void; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const sheet = narrow();
  const [pos, setPos] = useState({ left: x, top: y });

  // Não deixa o menu sair da tela (abre para cima ou para a esquerda se precisar)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (sheet) return el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, innerWidth - width - 8)),
      top: y + height > innerHeight - 8 ? Math.max(8, y - height) : y,
    });
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    };
    addEventListener('keydown', onKey);
    addEventListener('resize', onClose);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <>
      <div
        className={`backdrop ${sheet ? 'dim' : ''}`}
        onMouseDown={onClose}
        onContextMenu={e => {
          e.preventDefault();
          onClose();
        }}
      />
      <div ref={ref} className={`popover context-menu ${sheet ? 'sheet' : ''}`} role="menu" aria-label={title} style={sheet ? undefined : pos}>
        {sheet && title ? <div className="sheet-title">{title}</div> : null}
        {entries.map((entry, i) =>
          entry === 'sep' ? (
            <div key={`sep-${i}`} className="menu-sep" role="separator" />
          ) : (
            <button
              key={entry.label}
              role="menuitem"
              className={`menu-item ${entry.danger ? 'danger' : ''}`}
              disabled={entry.disabled}
              onClick={() => {
                onClose();
                entry.onClick();
              }}>
              <Icon name={entry.icon} size={18} filled={entry.filled} />
              <span className="menu-label">{entry.label}</span>
              {entry.hint ? <kbd className="menu-hint">{entry.hint}</kbd> : null}
            </button>
          ),
        )}
      </div>
    </>
  );
}
