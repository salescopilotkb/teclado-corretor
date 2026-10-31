/** Ícones do Locker web (traço de 2 px, 24×24, cor do texto em volta). */
import React from 'react';
import type { FileType } from './data';

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  drive: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  search: 'm20 20-4.5-4.5M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  chevron: 'm9 6 6 6-6 6',
  down: 'm6 9 6 6 6-6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 3 3L15 11l5 5M9 9.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
  video: 'M4 6h11v12H4zM15 10l5-3v10l-5-3',
  audio: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  pdf: 'M7 3h7l5 5v13H7zM14 3v5h5M9 14h6M9 17h4',
  document: 'M7 3h7l5 5v13H7zM14 3v5h5M9 12h8M9 15h8M9 18h5',
  other: 'M7 3h7l5 5v13H7zM14 3v5h5',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  keyboard: 'M3 7h18v10H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  move: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM10 13h6M13 10l3 3-3 3',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  rename: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  restore: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  check: 'm5 12.5 4.5 4.5L19 7',
  open: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  share: 'M16 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M16 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8.6 13.5l4.8 2.9M13.4 7.6l-4.8 2.9',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9',
  keyboardOff: 'M3 7h18v10H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10M3 3l18 18',
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2A6.5 6.5 0 0 1 21.5 20',
  offline: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7.5v7M8.8 11.5l3.2 3.2 3.2-3.2',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  cloudOff: 'M3 3l18 18M8 8a5 5 0 0 0-1 9h10M17.5 17A4 4 0 0 0 15 9.5a5 5 0 0 0-4-1.9',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, filled }: { name: IconName; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Ícone e cor de cada tipo (laranja KEYCON para pastas; tons leves para o resto). */
export const TYPE_STYLE: Record<FileType | 'folder', { icon: IconName; color: string }> = {
  folder: { icon: 'folder', color: 'var(--orange)' },
  image: { icon: 'image', color: '#D9534F' },
  video: { icon: 'video', color: '#C2416B' },
  audio: { icon: 'audio', color: '#7C5CC4' },
  pdf: { icon: 'pdf', color: '#C0392B' },
  document: { icon: 'document', color: '#3B6FD4' },
  other: { icon: 'other', color: '#5B6271' },
};

export function TypeIcon({ type, size = 20 }: { type: FileType | 'folder'; size?: number }) {
  const s = TYPE_STYLE[type];
  return (
    <span className="type-icon" style={{ color: s.color }}>
      <Icon name={s.icon} size={size} filled={type === 'folder'} />
    </span>
  );
}
