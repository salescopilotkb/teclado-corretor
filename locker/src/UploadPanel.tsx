/**
 * Painel de envios no canto de baixo, como no Drive: "Enviando 3 itens", o
 * progresso de cada um, cancelar, minimizar e fechar quando terminar.
 */
import React, { useEffect, useState } from 'react';
import { formatBytes } from '../../src/files/limits';
import { getLanguage, t } from '../../src/i18n';
import { fileType } from './data';
import { Icon, TypeIcon } from './icons';
import { cancelAllUploads, cancelUpload, clearFinishedUploads, subscribeUploads } from './upload';
import type { UploadJob } from './upload';

export function UploadPanel() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [minimized, setMinimized] = useState(false);
  useEffect(() => subscribeUploads(setJobs), []);

  const active = jobs.filter(j => j.status === 'waiting' || j.status === 'uploading' || j.retry);
  const waitingNet = jobs.filter(j => j.retry).length;
  // Aviso antes de fechar a aba com envio em andamento
  useEffect(() => {
    if (!active.length) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [active.length]);

  if (!jobs.length) return null;
  const done = jobs.filter(j => j.status === 'done').length;
  const failed = jobs.filter(j => j.status === 'error' && !j.retry).length;
  const title = waitingNet && waitingNet === active.length
    ? t('Aguardando a internet voltar')
    : active.length
    ? active.length === 1
      ? t('Enviando 1 item')
      : t('Enviando {n} itens', { n: active.length })
    : done === 1
      ? t('1 envio concluído')
      : t('{n} envios concluídos', { n: done });
  const lang = getLanguage();

  const close = () => {
    if (active.length && !confirm(t('Cancelar os envios que ainda não terminaram?'))) return;
    cancelAllUploads();
    clearFinishedUploads();
  };

  return (
    <section className={`uploads ${minimized ? 'min' : ''}`} aria-label={t('Envios')} aria-live="polite">
      <header className="uploads-head">
        <span className="uploads-title">{title}</span>
        <button className="icon-btn small on-dark" aria-label={minimized ? t('Mostrar envios') : t('Minimizar')} aria-expanded={!minimized} onClick={() => setMinimized(v => !v)}>
          <Icon name="down" size={18} className={minimized ? 'flip' : undefined} />
        </button>
        <button className="icon-btn small on-dark" aria-label={t('Fechar')} onClick={close}>
          <Icon name="close" size={18} />
        </button>
      </header>
      {!minimized ? (
        <>
          {failed ? <p className="uploads-sub">{failed === 1 ? t('1 envio não deu certo') : t('{n} envios não deram certo', { n: failed })}</p> : null}
          <ul className="uploads-list">
            {jobs.map(job => (
              <li key={job.id} className={`upload-row ${job.status} ${job.retry ? 'retry' : ''}`}>
                <TypeIcon type={fileType({ mime: job.mime, kind: '', name: job.name })} size={20} />
                <div className="upload-info">
                  <span className="name">{job.name}</span>
                  <span className="upload-meta">
                    {job.status === 'error'
                      ? job.error
                      : job.status === 'canceled'
                        ? t('Cancelado')
                        : job.status === 'waiting'
                          ? t('Na fila')
                          : formatBytes(job.size, lang)}
                  </span>
                </div>
                <Status job={job} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function Status({ job }: { job: UploadJob }) {
  if (job.status === 'done') {
    return (
      <span className="upload-ok" aria-label={t('Enviado')}>
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="currentColor" />
          <path d="m7 12.5 3.2 3L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (job.retry) {
    return (
      <span className="upload-wait" aria-label={t('Aguardando a internet')}>
        <Icon name="clock" size={20} />
      </span>
    );
  }
  if (job.status === 'error') {
    return (
      <span className="upload-err" aria-label={t('Erro')}>
        !
      </span>
    );
  }
  if (job.status === 'canceled') return <span className="upload-gap" />;
  // Na fila ou enviando: o anel de progresso, que vira o X de cancelar ao passar o mouse
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <button className="upload-cancel" aria-label={t('Cancelar envio de {name}', { name: job.name })} title={t('Cancelar')} onClick={() => cancelUpload(job.id)}>
      <svg className="ring" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="11" cy="11" r={r} fill="none" stroke="var(--field)" strokeWidth="3" />
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke="var(--orange)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.04, job.progress))}
          transform="rotate(-90 11 11)"
        />
      </svg>
      <Icon name="close" size={16} className="x" />
    </button>
  );
}
