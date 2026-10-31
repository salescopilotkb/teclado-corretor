/**
 * Prévia em tela cheia, como a do Drive: fundo escuro, o nome e as ações em cima,
 * setas para o anterior e o próximo (também ← e →), Esc fecha.
 * Imagem (com zoom), vídeo, áudio e PDF abrem aqui; o resto mostra o botão Baixar.
 */
import React, { useEffect, useState } from 'react';
import { formatBytes } from '../../src/files/limits';
import { getLanguage, t } from '../../src/i18n';
import { fileType, fileUrl } from './data';
import type { LockerFile } from './data';
import { Icon, TypeIcon } from './icons';

export function Preview({
  files,
  startId,
  onClose,
  onDownload,
  onCopyLink,
  onShare,
}: {
  files: LockerFile[];
  startId: string;
  onClose: () => void;
  onDownload: (file: LockerFile) => void;
  onCopyLink: (file: LockerFile) => void;
  onShare: (file: LockerFile) => void;
}) {
  const [id, setId] = useState(startId);
  const index = Math.max(0, files.findIndex(f => f.id === id));
  const file = files[index];
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  /** Onde o dedo começou (para passar de arquivo arrastando para o lado). */
  const swipe = React.useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setUrl('');
    setFailed(false);
    setZoom(1);
    fileUrl(file)
      .then(u => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [file]);

  // O arquivo saiu da lista (apagado em outro lugar): fecha
  useEffect(() => {
    if (!file) onClose();
  }, [file, onClose]);

  const go = (delta: number) => {
    const next = files[index + delta];
    if (next) setId(next.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === '+' || e.key === '=') setZoom(z => Math.min(4, z + 0.5));
      else if (e.key === '-') setZoom(z => Math.max(1, z - 0.5));
    };
    addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  });

  if (!file) return null;
  const type = fileType(file);
  const lang = getLanguage();
  const showsInFrame = type === 'pdf' || file.mime.startsWith('text/');

  let body: React.ReactNode;
  if (failed) {
    body = <NoPreview file={file} text={t('Não foi possível abrir o arquivo.')} onDownload={onDownload} />;
  } else if (!url) {
    body = <span className="spinner" />;
  } else if (type === 'image') {
    body = (
      <div className={`pv-image-wrap ${zoom > 1 ? 'zoomed' : ''}`} onClick={e => e.stopPropagation()}>
        <img
          className="pv-image"
          src={url}
          alt={file.name}
          style={{ transform: `scale(${zoom})` }}
          onDoubleClick={() => setZoom(z => (z > 1 ? 1 : 2))}
          onError={() => setFailed(true)}
        />
      </div>
    );
  } else if (type === 'video') {
    body = <video key={url} className="pv-video" src={url} controls autoPlay playsInline onClick={e => e.stopPropagation()} onError={() => setFailed(true)} />;
  } else if (type === 'audio') {
    body = (
      <div className="pv-audio" onClick={e => e.stopPropagation()}>
        <TypeIcon type="audio" size={64} />
        <span className="pv-audio-name">{file.name}</span>
        <audio key={url} src={url} controls autoPlay onError={() => setFailed(true)} />
      </div>
    );
  } else if (showsInFrame) {
    body = <iframe className="pv-frame" src={url} title={file.name} onClick={e => e.stopPropagation()} />;
  } else {
    body = <NoPreview file={file} text={t('Este tipo de arquivo não tem prévia.')} onDownload={onDownload} />;
  }

  return (
    <div
      className="preview"
      role="dialog"
      aria-modal="true"
      aria-label={t('Prévia de {name}', { name: file.name })}
      onClick={onClose}
      onTouchStart={e => {
        const touch = e.touches[0];
        swipe.current = e.touches.length === 1 && zoom === 1 ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchEnd={e => {
        const start = swipe.current;
        swipe.current = null;
        if (!start) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - start.x;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(touch.clientY - start.y) * 1.5) go(dx < 0 ? 1 : -1);
      }}>
      <header className="pv-top" onClick={e => e.stopPropagation()}>
        <button className="icon-btn on-dark" aria-label={t('Fechar')} title={t('Fechar (Esc)')} onClick={onClose}>
          <Icon name="close" />
        </button>
        <TypeIcon type={type} />
        <div className="pv-title">
          <span className="name">{file.name}</span>
          <span className="pv-meta">{formatBytes(Number(file.size_bytes) || 0, lang)}</span>
        </div>
        {type === 'image' ? (
          <>
            <button className="icon-btn on-dark" aria-label={t('Diminuir')} disabled={zoom <= 1} onClick={() => setZoom(z => Math.max(1, z - 0.5))}>
              <span className="pv-zoom">−</span>
            </button>
            <button className="icon-btn on-dark" aria-label={t('Aumentar')} disabled={zoom >= 4} onClick={() => setZoom(z => Math.min(4, z + 0.5))}>
              <span className="pv-zoom">+</span>
            </button>
          </>
        ) : null}
        <button className="icon-btn on-dark" aria-label={t('Copiar link')} title={t('Copiar link')} onClick={() => onCopyLink(file)}>
          <Icon name="link" />
        </button>
        <button className="icon-btn on-dark" aria-label={t('Compartilhar')} title={t('Compartilhar')} onClick={() => onShare(file)}>
          <Icon name="share" />
        </button>
        <button className="icon-btn on-dark" aria-label={t('Baixar')} title={t('Baixar')} onClick={() => onDownload(file)}>
          <Icon name="download" />
        </button>
      </header>

      <div className="pv-body">{body}</div>

      {index > 0 ? (
        <button
          className="pv-nav prev"
          aria-label={t('Anterior')}
          onClick={e => {
            e.stopPropagation();
            go(-1);
          }}>
          <Icon name="chevron" size={28} className="flip-x" />
        </button>
      ) : null}
      {index < files.length - 1 ? (
        <button
          className="pv-nav next"
          aria-label={t('Próximo')}
          onClick={e => {
            e.stopPropagation();
            go(1);
          }}>
          <Icon name="chevron" size={28} />
        </button>
      ) : null}
      {files.length > 1 ? (
        <span className="pv-count" aria-hidden="true">
          {index + 1} / {files.length}
        </span>
      ) : null}
    </div>
  );
}

function NoPreview({ file, text, onDownload }: { file: LockerFile; text: string; onDownload: (f: LockerFile) => void }) {
  return (
    <div className="pv-none" onClick={e => e.stopPropagation()}>
      <TypeIcon type={fileType(file)} size={56} />
      <p>{text}</p>
      <button className="btn primary" onClick={() => onDownload(file)}>
        <Icon name="download" size={18} />
        {t('Baixar')}
      </button>
    </div>
  );
}
